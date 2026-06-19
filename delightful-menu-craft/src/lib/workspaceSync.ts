import { create } from 'zustand';
import { toast } from 'sonner';
import { supabase } from './supabase';
import {
  useMenuStore,
  STORE_VERSION,
  WORKSPACE_DATA_KEYS,
  createFreshWorkspaceData,
  type WorkspaceData,
} from '@/store/menuStore';

const CURRENT_KEY = 'menu-manager-current-workspace';
const SAVE_DEBOUNCE_MS = 1500;
/**
 * A live editor refreshes `locked_at` every tick (see EDITOR_TICK_MS). If it
 * hasn't been refreshed within this window the holder's tab is presumed gone
 * (closed/crashed) and the lock is claimable. Kept generous enough to tolerate
 * background-tab setInterval throttling, short enough to recover quickly.
 */
export const ABANDONED_MS = 90_000;
/** Editor tick: heartbeat + lost-lock detection + admin force-signal + idle release. */
const EDITOR_TICK_MS = 8_000;
/** A holder whose tab is open but idle this long voluntarily releases the lock. */
const IDLE_RELEASE_MS = 30 * 60 * 1000;
/** How often a viewer re-checks whether the lock has freed up. */
const LOCK_POLL_MS = 15_000;
/** How long forceTakeOver waits for the editor to release before overriding. */
const FORCE_WAIT_MS = 10_000;

/** Lightweight row used by the project picker (no heavy `data` blob). */
export interface WorkspaceMeta {
  id: string;
  name: string;
  version: number;
  updated_at: string;
  updated_by: string | null;
  created_by: string | null;
  locked_by: string | null;
  locked_by_email: string | null;
  locked_at: string | null;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

interface WorkspaceSession {
  currentId: string | null;
  currentName: string | null;
  version: number | null; // version we loaded / last successfully saved
  status: SaveStatus;
  isEditor: boolean; // do we hold the edit lock for the open project?
  lockedByEmail: string | null; // who holds it (when we don't)
  canTakeOver: boolean; // lock is free or stale → a viewer may take over
}

export const useWorkspaceSession = create<WorkspaceSession>(() => ({
  currentId: null,
  currentName: null,
  version: null,
  status: 'idle',
  isEditor: false,
  lockedByEmail: null,
  canTakeOver: false,
}));

const setSession = (patch: Partial<WorkspaceSession>) => useWorkspaceSession.setState(patch);

/** True when a project is open but this tab does not hold the edit lock. */
export function useIsReadOnly(): boolean {
  return useWorkspaceSession((s) => s.currentId != null && !s.isEditor);
}

// --- module state ------------------------------------------------------------
let unsubscribe: (() => void) | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let editorTickTimer: ReturnType<typeof setInterval> | null = null;
let lockPollTimer: ReturnType<typeof setInterval> | null = null;
let activityAttached = false;
let lastActivityAt = 0;
let currentUid: string | null = null;
let currentEmail: string | null = null;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();

// --- diagnostic logging (flip LOCK_DEBUG to false to silence) ----------------
const LOCK_DEBUG = false;
const TAB_ID =
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 4) : '----';

/** Seconds since a `locked_at` timestamp (null-safe), for readable logs. */
function lockAgeSec(lockedAt: string | null | undefined): number | null {
  if (!lockedAt) return null;
  return Math.round((Date.now() - new Date(lockedAt).getTime()) / 1000);
}

function lockLog(action: string, detail?: Record<string, unknown>): void {
  if (!LOCK_DEBUG) return;
  const s = useWorkspaceSession.getState();
  console.log(`[lock ${TAB_ID}]`, action, {
    uid: currentUid?.slice(0, 8) ?? null,
    project: s.currentId,
    isEditor: s.isEditor,
    ...detail,
  });
}

/** Log every locked row the DB returns for the project list (spot duplicate holders). */
export function logWorkspaceLockSnapshot(rows: WorkspaceMeta[]): void {
  if (!LOCK_DEBUG) return;
  const locked = rows
    .filter((r) => r.locked_by)
    .map((r) => ({
      name: r.name,
      locked_by_email: r.locked_by_email,
      locked_by: r.locked_by?.slice(0, 8) ?? null,
      ageSec: lockAgeSec(r.locked_at),
    }));
  console.log(`[lock ${TAB_ID}] list-snapshot`, { lockedCount: locked.length, locked });
}

// --- autosave plumbing (editor only) -----------------------------------------
function stopAutosave() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

function startAutosave() {
  stopAutosave();
  // Fire only when a data field reference changes (UI-only changes are ignored).
  unsubscribe = useMenuStore.subscribe((state, prev) => {
    const changed = WORKSPACE_DATA_KEYS.some((k) => state[k] !== prev[k]);
    if (changed) {
      lastActivityAt = Date.now();
      scheduleSave();
    }
  });
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveNow();
  }, SAVE_DEBOUNCE_MS);
}

// --- activity tracking -------------------------------------------------------
function markActivity() {
  lastActivityAt = Date.now();
}

function attachActivityListeners() {
  if (activityAttached || typeof window === 'undefined') return;
  activityAttached = true;
  lastActivityAt = Date.now();
  window.addEventListener('mousemove', markActivity, { passive: true });
  window.addEventListener('keydown', markActivity, { passive: true });
  window.addEventListener('click', markActivity, { passive: true });
}

function detachActivityListeners() {
  if (!activityAttached || typeof window === 'undefined') return;
  activityAttached = false;
  window.removeEventListener('mousemove', markActivity);
  window.removeEventListener('keydown', markActivity);
  window.removeEventListener('click', markActivity);
}

// --- lock primitives ---------------------------------------------------------
interface LockState {
  locked_by: string | null;
  locked_by_email: string | null;
  locked_at: string | null;
  force_takeover_by: string | null;
}

async function fetchLockState(id: string): Promise<LockState | null> {
  const { data } = await supabase
    .from('workspaces')
    .select('locked_by, locked_by_email, locked_at, force_takeover_by')
    .eq('id', id)
    .maybeSingle();
  return (data as LockState | null) ?? null;
}

/** Atomically claim the lock if it is free, already ours, or stale. */
async function claimLock(id: string, uid: string, email: string | null): Promise<boolean> {
  const staleBefore = new Date(Date.now() - ABANDONED_MS).toISOString();
  const { data, error } = await supabase
    .from('workspaces')
    .update({
      locked_by: uid,
      locked_by_email: email,
      locked_at: nowIso(),
      force_takeover_by: null,
      force_takeover_at: null,
    })
    .eq('id', id)
    .or(`locked_by.is.null,locked_by.eq.${uid},locked_at.lt.${staleBefore}`)
    .select('locked_by')
    .maybeSingle();
  const won = !error && !!data && (data as { locked_by: string | null }).locked_by === uid;
  lockLog('claimLock', { id, staleBefore, won, error: error?.message, row: data });

  // One active edit per user: becoming editor of `id` drops this user's lock on
  // every other project, so a forgotten/second tab can't keep them "editing"
  // two projects at once. Other tabs detect the loss on their next editorTick.
  if (won) {
    const { data: cleared } = await supabase
      .from('workspaces')
      .update({
        locked_by: null,
        locked_by_email: null,
        locked_at: null,
        force_takeover_by: null,
        force_takeover_at: null,
      })
      .eq('locked_by', uid)
      .neq('id', id)
      .select('id');
    if (cleared?.length) lockLog('claimLock:released-others', { count: cleared.length });
  }
  return won;
}

/** Release a specific project's lock if we hold it. */
async function releaseLockFor(id: string): Promise<void> {
  if (!currentUid) {
    lockLog('releaseLockFor:skip', { id, reason: 'no currentUid' });
    return;
  }
  const { data, error } = await supabase
    .from('workspaces')
    .update({
      locked_by: null,
      locked_by_email: null,
      locked_at: null,
      force_takeover_by: null,
      force_takeover_at: null,
    })
    .eq('id', id)
    .eq('locked_by', currentUid)
    .select('id');
  lockLog('releaseLockFor', { id, cleared: data?.length ?? 0, error: error?.message });
}

/** Release the currently-open project's lock if we hold it. */
async function releaseLock(): Promise<void> {
  const { currentId } = useWorkspaceSession.getState();
  if (!currentId) return;
  await releaseLockFor(currentId);
}

function stopEditorTick() {
  if (editorTickTimer) {
    clearInterval(editorTickTimer);
    editorTickTimer = null;
  }
}

function startEditorTick() {
  stopEditorTick();
  editorTickTimer = setInterval(() => void editorTick(), EDITOR_TICK_MS);
}

async function editorTick() {
  const { currentId, isEditor } = useWorkspaceSession.getState();
  if (!currentId || !isEditor || !currentUid) return;
  const lock = await fetchLockState(currentId);
  if (!lock) {
    lockLog('editorTick:no-row', { currentId });
    return;
  }

  // An admin requested a force take-over: flush our edits, then release.
  if (lock.force_takeover_by && lock.force_takeover_by !== currentUid) {
    lockLog('editorTick:force-takeover', { force_takeover_by: lock.force_takeover_by?.slice(0, 8) });
    await saveNow();
    await releaseLock();
    becomeViewer();
    toast.info('An admin took over editing this project.');
    return;
  }

  // We lost the lock (someone took over).
  if (lock.locked_by !== currentUid) {
    lockLog('editorTick:lost-lock', {
      now_locked_by: lock.locked_by?.slice(0, 8) ?? null,
      now_email: lock.locked_by_email,
    });
    becomeViewer(lock.locked_by_email);
    toast.info(`${lock.locked_by_email ?? 'Someone'} took over editing.`);
    return;
  }

  // Tab open but idle too long ("went home"): voluntarily hand the lock back.
  if (Date.now() - lastActivityAt > IDLE_RELEASE_MS) {
    lockLog('editorTick:idle-release', { idleSec: Math.round((Date.now() - lastActivityAt) / 1000) });
    await releaseLock();
    becomeViewer();
    toast.info('Editing released after inactivity.');
    return;
  }

  lockLog('editorTick:heartbeat', { ageSec: lockAgeSec(lock.locked_at) });

  // Still ours and active: keep the lease fresh. A live tab heartbeats every
  // tick; a closed/crashed tab stops, so the lock goes stale within ABANDONED_MS.
  await supabase
    .from('workspaces')
    .update({ locked_at: nowIso() })
    .eq('id', currentId)
    .eq('locked_by', currentUid);
}

function stopLockPoll() {
  if (lockPollTimer) {
    clearInterval(lockPollTimer);
    lockPollTimer = null;
  }
}

function startLockPoll() {
  stopLockPoll();
  void lockPoll();
  lockPollTimer = setInterval(() => void lockPoll(), LOCK_POLL_MS);
}

async function lockPoll() {
  const { currentId } = useWorkspaceSession.getState();
  if (!currentId) return;
  const lock = await fetchLockState(currentId);
  if (!lock) return;
  const stale = lock.locked_at
    ? Date.now() - new Date(lock.locked_at).getTime() > ABANDONED_MS
    : true;
  const canTakeOver = !lock.locked_by || stale;
  lockLog('lockPoll', {
    locked_by_email: lock.locked_by_email,
    ageSec: lockAgeSec(lock.locked_at),
    stale,
    canTakeOver,
  });
  setSession({ lockedByEmail: lock.locked_by_email, canTakeOver });
}

// --- role transitions --------------------------------------------------------
function becomeEditor() {
  lockLog('becomeEditor');
  stopLockPoll();
  useMenuStore.getState().setReadOnly(false);
  setSession({ isEditor: true, lockedByEmail: null, canTakeOver: false, status: 'saved' });
  attachActivityListeners();
  startAutosave();
  startEditorTick();
}

function becomeViewer(lockedByEmail: string | null = null) {
  lockLog('becomeViewer', { lockedByEmail });
  stopAutosave();
  stopEditorTick();
  detachActivityListeners();
  useMenuStore.getState().setReadOnly(true);
  setSession({ isEditor: false, lockedByEmail, canTakeOver: false, status: 'idle' });
  startLockPoll();
}

function teardownLockTimers() {
  stopEditorTick();
  stopLockPoll();
  detachActivityListeners();
}

async function currentUser(): Promise<{ id: string | null; email: string | null }> {
  const { data } = await supabase.auth.getUser();
  return { id: data.user?.id ?? null, email: data.user?.email ?? null };
}

// Best-effort lock release if the tab is closed/navigated away. The ABANDONED_MS
// staleness backstop covers the case where this doesn't complete in time.
// (Deliberately NOT on visibilitychange — that fires on harmless tab switches.)
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    const editing = useWorkspaceSession.getState().isEditor;
    lockLog('pagehide', { editing });
    if (editing) void releaseLock();
  });
}

// --- public API --------------------------------------------------------------
const META_COLS = 'id, name, version, updated_at, updated_by, created_by, locked_by, locked_by_email, locked_at';

export async function listWorkspaces(): Promise<WorkspaceMeta[]> {
  const { data, error } = await supabase
    .from('workspaces')
    .select(META_COLS)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkspaceMeta[];
}

export async function createWorkspace(name: string, data?: WorkspaceData): Promise<WorkspaceMeta> {
  const uid = (await currentUser()).id;
  const { data: row, error } = await supabase
    .from('workspaces')
    .insert({
      name,
      data: data ?? createFreshWorkspaceData(),
      schema_version: STORE_VERSION,
      version: 1,
      created_by: uid,
      updated_by: uid,
    })
    .select(META_COLS)
    .single();
  if (error) throw new Error(error.message);
  return row as WorkspaceMeta;
}

export async function openWorkspace(id: string): Promise<void> {
  // Switching to a different project while holding a lock: release the old one
  // first so we don't appear to be editing two projects at once.
  const prev = useWorkspaceSession.getState();
  lockLog('openWorkspace', { target: id, prevId: prev.currentId, prevIsEditor: prev.isEditor });
  if (prev.currentId && prev.currentId !== id && prev.isEditor) {
    await releaseLockFor(prev.currentId);
  }

  teardownLockTimers();
  stopAutosave();

  const { data: row, error } = await supabase.from('workspaces').select('*').eq('id', id).single();
  if (error || !row) throw new Error(error?.message ?? 'Workspace not found');

  const { id: uid, email } = await currentUser();
  currentUid = uid;
  currentEmail = email;

  // Hydrate the store BEFORE subscribing, so the load itself doesn't trigger a save.
  useMenuStore.getState().hydrateWorkspace(row.data, row.schema_version ?? STORE_VERSION);
  setSession({
    currentId: row.id,
    currentName: row.name,
    version: row.version,
    status: 'saved',
    isEditor: false,
    lockedByEmail: null,
    canTakeOver: false,
  });
  sessionStorage.setItem(CURRENT_KEY, row.id);

  const won = uid ? await claimLock(row.id, uid, email) : false;
  if (won) {
    becomeEditor();
  } else {
    becomeViewer(row.locked_by_email ?? null);
  }
}

/** Become the editor when the lock is free/stale (normal viewer take-over). */
export async function takeOver(): Promise<void> {
  const { currentId, canTakeOver } = useWorkspaceSession.getState();
  if (!currentId || !canTakeOver || !currentUid) return;
  lockLog('takeOver:start', { currentId });
  const won = await claimLock(currentId, currentUid, currentEmail);
  if (!won) {
    await lockPoll();
    toast.error('Someone else just started editing — try again.');
    return;
  }
  // Re-hydrate to pull the previous editor's latest saved state, then edit.
  await openWorkspace(currentId);
}

/** Admin override: signal the editor to flush + release, then claim the lock. */
export async function forceTakeOver(): Promise<void> {
  const { currentId } = useWorkspaceSession.getState();
  if (!currentId || !currentUid) return;
  lockLog('forceTakeOver:start', { currentId });

  const { error } = await supabase.rpc('request_force_takeover', { p_workspace: currentId });
  if (error) {
    lockLog('forceTakeOver:rpc-error', { error: error.message });
    toast.error(`Force take over failed: ${error.message}`);
    return;
  }

  // Wait for the editor's tab to flush its edits and release the lock.
  const deadline = Date.now() + FORCE_WAIT_MS;
  let freed = false;
  while (Date.now() < deadline) {
    await sleep(1000);
    const lock = await fetchLockState(currentId);
    if (!lock || !lock.locked_by) {
      freed = true;
      break;
    }
  }
  lockLog('forceTakeOver:waited', { freed });

  let won = await claimLock(currentId, currentUid, currentEmail);
  if (!won) {
    lockLog('forceTakeOver:override');
    // Editor never released (tab closed/offline). Override — their last autosave
    // was at most ~1.5s ago, so little to nothing is lost.
    const { error: overrideErr } = await supabase
      .from('workspaces')
      .update({
        locked_by: currentUid,
        locked_by_email: currentEmail,
        locked_at: nowIso(),
        force_takeover_by: null,
        force_takeover_at: null,
      })
      .eq('id', currentId);
    won = !overrideErr;
  }
  if (!won) {
    toast.error('Could not take over — please try again.');
    return;
  }
  await openWorkspace(currentId);
}

/** The workspace id this tab had open (survives an in-tab refresh). */
export function rememberedWorkspaceId(): string | null {
  return sessionStorage.getItem(CURRENT_KEY);
}

function clearSession(): void {
  teardownLockTimers();
  stopAutosave();
  useMenuStore.getState().setReadOnly(false);
  setSession({
    currentId: null,
    currentName: null,
    version: null,
    status: 'idle',
    isEditor: false,
    lockedByEmail: null,
    canTakeOver: false,
  });
  sessionStorage.removeItem(CURRENT_KEY);
}

export function closeWorkspace(): void {
  lockLog('closeWorkspace');
  void releaseLock();
  clearSession();
}

/**
 * Awaitable leave — releases the lock and waits for it before clearing session.
 * Use before sign-out, where the release UPDATE must complete while the JWT is
 * still valid.
 */
export async function leaveWorkspace(): Promise<void> {
  lockLog('leaveWorkspace');
  await releaseLock();
  clearSession();
}

export async function deleteWorkspace(id: string): Promise<void> {
  const { error } = await supabase.from('workspaces').delete().eq('id', id);
  if (error) throw new Error(error.message);
  if (useWorkspaceSession.getState().currentId === id) closeWorkspace();
}

export async function saveNow(): Promise<void> {
  const { currentId, version, isEditor } = useWorkspaceSession.getState();
  if (currentId == null || version == null || !isEditor) return;

  setSession({ status: 'saving' });
  const data = useMenuStore.getState().serializeWorkspace();

  // Optimistic concurrency: only succeeds if the row is still at the version we loaded.
  const { data: rows, error } = await supabase
    .from('workspaces')
    .update({ data, schema_version: STORE_VERSION, version: version + 1, updated_by: currentUid })
    .eq('id', currentId)
    .eq('version', version)
    .select('version');

  if (error) {
    setSession({ status: 'error' });
    toast.error(`Save failed: ${error.message}`);
    return;
  }

  if (!rows || rows.length === 0) {
    // Version moved underneath us — should be rare under the single-editor lock.
    setSession({ status: 'conflict' });
    toast.error('This project changed in another window.', {
      duration: Infinity,
      description: 'Reload to get the latest, or overwrite with your version.',
      action: { label: 'Reload', onClick: () => void openWorkspace(currentId) },
      cancel: { label: 'Overwrite', onClick: () => void overwriteConflict() },
    });
    return;
  }

  setSession({ version: rows[0].version as number, status: 'saved' });
}

/** Discard the version guard and force the local state to win the conflict. */
export async function overwriteConflict(): Promise<void> {
  const { currentId } = useWorkspaceSession.getState();
  if (!currentId) return;
  const { data: latest, error } = await supabase
    .from('workspaces')
    .select('version')
    .eq('id', currentId)
    .single();
  if (error || !latest) {
    toast.error('Could not overwrite — please reload.');
    return;
  }
  // Adopt the latest version so the guarded saveNow() will match.
  setSession({ version: latest.version as number });
  await saveNow();
}
