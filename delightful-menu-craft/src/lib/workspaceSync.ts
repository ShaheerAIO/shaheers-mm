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

/** Lightweight row used by the project picker (no heavy `data` blob). */
export interface WorkspaceMeta {
  id: string;
  name: string;
  version: number;
  updated_at: string;
  updated_by: string | null;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

interface WorkspaceSession {
  currentId: string | null;
  currentName: string | null;
  version: number | null; // version we loaded / last successfully saved
  status: SaveStatus;
}

export const useWorkspaceSession = create<WorkspaceSession>(() => ({
  currentId: null,
  currentName: null,
  version: null,
  status: 'idle',
}));

const setSession = (patch: Partial<WorkspaceSession>) => useWorkspaceSession.setState(patch);

// --- autosave plumbing -------------------------------------------------------
let unsubscribe: (() => void) | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

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
    if (changed) scheduleSave();
  });
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveNow();
  }, SAVE_DEBOUNCE_MS);
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// --- public API --------------------------------------------------------------

export async function listWorkspaces(): Promise<WorkspaceMeta[]> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('id, name, version, updated_at, updated_by')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkspaceMeta[];
}

export async function createWorkspace(name: string, data?: WorkspaceData): Promise<WorkspaceMeta> {
  const uid = await currentUserId();
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
    .select('id, name, version, updated_at, updated_by')
    .single();
  if (error) throw new Error(error.message);
  return row as WorkspaceMeta;
}

export async function openWorkspace(id: string): Promise<void> {
  stopAutosave();
  const { data: row, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !row) throw new Error(error?.message ?? 'Workspace not found');

  // Hydrate the store BEFORE subscribing, so the load itself doesn't trigger a save.
  useMenuStore.getState().hydrateWorkspace(row.data, row.schema_version ?? STORE_VERSION);
  setSession({ currentId: row.id, currentName: row.name, version: row.version, status: 'saved' });
  sessionStorage.setItem(CURRENT_KEY, row.id);
  startAutosave();
}

/** The workspace id this tab had open (survives an in-tab refresh). */
export function rememberedWorkspaceId(): string | null {
  return sessionStorage.getItem(CURRENT_KEY);
}

export function closeWorkspace(): void {
  stopAutosave();
  setSession({ currentId: null, currentName: null, version: null, status: 'idle' });
  sessionStorage.removeItem(CURRENT_KEY);
}

export async function deleteWorkspace(id: string): Promise<void> {
  const { error } = await supabase.from('workspaces').delete().eq('id', id);
  if (error) throw new Error(error.message);
  if (useWorkspaceSession.getState().currentId === id) closeWorkspace();
}

export async function saveNow(): Promise<void> {
  const { currentId, version } = useWorkspaceSession.getState();
  if (currentId == null || version == null) return;

  setSession({ status: 'saving' });
  const data = useMenuStore.getState().serializeWorkspace();
  const uid = await currentUserId();

  // Optimistic concurrency: only succeeds if the row is still at the version we loaded.
  const { data: rows, error } = await supabase
    .from('workspaces')
    .update({ data, schema_version: STORE_VERSION, version: version + 1, updated_by: uid })
    .eq('id', currentId)
    .eq('version', version)
    .select('version');

  if (error) {
    setSession({ status: 'error' });
    toast.error(`Save failed: ${error.message}`);
    return;
  }

  if (!rows || rows.length === 0) {
    // Version moved underneath us — another window saved first.
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
