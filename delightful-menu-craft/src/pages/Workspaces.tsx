import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, LogOut, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import {
  listWorkspaces,
  createWorkspace,
  openWorkspace,
  deleteWorkspace,
  type WorkspaceMeta,
} from '@/lib/workspaceSync';
import { runMigrations, WORKSPACE_DATA_KEYS, type WorkspaceData } from '@/store/menuStore';

/** Read any pre-Supabase work left in localStorage so it isn't lost on upgrade. */
function readLegacyData(): WorkspaceData | null {
  try {
    const raw = localStorage.getItem('menu-manager-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown>; version?: number };
    const state = parsed?.state;
    if (!state || !Array.isArray(state.menus)) return null;
    const hasContent =
      (state.menus as unknown[]).length > 0 ||
      (Array.isArray(state.items) && state.items.length > 0);
    if (!hasContent) return null;
    const migrated = runMigrations({ ...state }, parsed.version ?? 0) as unknown as Record<string, unknown>;
    const data = {} as WorkspaceData;
    for (const key of WORKSPACE_DATA_KEYS) {
      (data as Record<string, unknown>)[key] = migrated[key];
    }
    return data;
  } catch {
    return null;
  }
}

export default function Workspaces() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceMeta[] | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [legacy] = useState(() => readLegacyData());

  useEffect(() => {
    listWorkspaces()
      .then(setWorkspaces)
      .catch((e) => {
        toast.error(`Could not load projects: ${e.message}`);
        setWorkspaces([]);
      });
  }, []);

  const refresh = () => listWorkspaces().then(setWorkspaces).catch(() => {});

  const handleCreate = async (data?: WorkspaceData) => {
    const name = newName.trim() || 'Untitled project';
    setBusy(true);
    try {
      const ws = await createWorkspace(name, data);
      await openWorkspace(ws.id);
      navigate('/');
    } catch (e) {
      toast.error(`Could not create project: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async (id: string) => {
    setBusy(true);
    try {
      await openWorkspace(id);
      navigate('/');
    } catch (e) {
      toast.error(`Could not open project: ${(e as Error).message}`);
      setBusy(false);
    }
  };

  const handleDelete = async (ws: WorkspaceMeta) => {
    if (!confirm(`Delete "${ws.name}"? This cannot be undone.`)) return;
    try {
      await deleteWorkspace(ws.id);
      toast.success(`Deleted "${ws.name}"`);
      refresh();
    } catch (e) {
      toast.error(`Could not delete: ${(e as Error).message}`);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Projects</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>

        {legacy && (
          <Card className="mb-4 border-amber-500/40 bg-amber-500/5 p-4">
            <p className="text-sm">
              We found menu work saved locally in this browser. Import it into a new cloud
              project so it isn't lost.
            </p>
            <Button
              size="sm"
              className="mt-3"
              disabled={busy}
              onClick={() => void handleCreate(legacy)}
            >
              Import previous local work
            </Button>
          </Card>
        )}

        <Card className="mb-6 p-4">
          <div className="flex gap-2">
            <Input
              placeholder="New project name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !busy && void handleCreate()}
            />
            <Button disabled={busy} onClick={() => void handleCreate()}>
              <Plus className="mr-2 h-4 w-4" /> Create
            </Button>
          </div>
        </Card>

        {workspaces === null ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : workspaces.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No projects yet. Create one above to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {workspaces.map((ws) => (
              <Card key={ws.id} className="flex items-center justify-between p-4">
                <button
                  className="flex flex-1 items-center gap-3 text-left"
                  disabled={busy}
                  onClick={() => void handleOpen(ws.id)}
                >
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{ws.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Updated {new Date(ws.updated_at).toLocaleString()}
                    </div>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void handleDelete(ws)}
                  aria-label={`Delete ${ws.name}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
