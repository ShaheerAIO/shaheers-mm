import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, LogOut, FolderOpen, Lock, Search, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  listWorkspaces,
  createWorkspace,
  openWorkspace,
  deleteWorkspace,
  renameWorkspace,
  logWorkspaceLockSnapshot,
  ABANDONED_MS,
  type WorkspaceMeta,
} from '@/lib/workspaceSync';
import { type WorkspaceData } from '@/store/menuStore';
import { useUserPreferencesStore } from '@/store/userPreferencesStore';

type OwnerFilter = 'all' | 'me' | 'others';

export default function Workspaces() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceMeta[] | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const sortOrder = useUserPreferencesStore((s) => s.workspaceSort);
  const setSortOrder = useUserPreferencesStore((s) => s.setWorkspaceSort);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    listWorkspaces()
      .then((rows) => {
        logWorkspaceLockSnapshot(rows);
        setWorkspaces(rows);
      })
      .catch((e) => {
        toast.error(`Could not load projects: ${e.message}`);
        setWorkspaces([]);
      });
  }, []);

  const refresh = () =>
    listWorkspaces()
      .then((rows) => {
        logWorkspaceLockSnapshot(rows);
        setWorkspaces(rows);
      })
      .catch(() => {});

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

  const startRename = (ws: WorkspaceMeta) => {
    setRenamingId(ws.id);
    setRenameValue(ws.name);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  const commitRename = async (ws: WorkspaceMeta) => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === ws.name) {
      cancelRename();
      return;
    }
    setRenaming(true);
    try {
      await renameWorkspace(ws.id, trimmed);
      setWorkspaces((prev) => prev?.map((w) => (w.id === ws.id ? { ...w, name: trimmed } : w)) ?? prev);
      cancelRename();
    } catch (e) {
      toast.error(`Could not rename: ${(e as Error).message}`);
    } finally {
      setRenaming(false);
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

  const ownerCounts = useMemo(() => {
    const all = workspaces ?? [];
    const mine = all.filter((ws) => ws.created_by === user?.id).length;
    return { all: all.length, me: mine, others: all.length - mine };
  }, [workspaces, user?.id]);

  const visibleWorkspaces = useMemo(() => {
    const all = workspaces ?? [];
    const query = search.trim().toLowerCase();
    const filtered = all.filter((ws) => {
      const isMine = ws.created_by === user?.id;
      if (ownerFilter === 'me' && !isMine) return false;
      if (ownerFilter === 'others' && isMine) return false;
      if (query && !ws.name.toLowerCase().includes(query)) return false;
      return true;
    });
    return [...filtered].sort((a, b) =>
      sortOrder === 'name'
        ? a.name.localeCompare(b.name)
        : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }, [workspaces, search, ownerFilter, sortOrder, user?.id]);

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

        {workspaces !== null && workspaces.length > 0 && (
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={ownerFilter} onValueChange={(v) => setOwnerFilter(v as OwnerFilter)}>
              <TabsList>
                <TabsTrigger value="all">All ({ownerCounts.all})</TabsTrigger>
                <TabsTrigger value="me">Me ({ownerCounts.me})</TabsTrigger>
                <TabsTrigger value="others">Others ({ownerCounts.others})</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search projects…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as typeof sortOrder)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">Recently updated</SelectItem>
                  <SelectItem value="name">Name (A–Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {workspaces === null ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : workspaces.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No projects yet. Create one above to get started.
          </p>
        ) : visibleWorkspaces.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No projects match your filters.
          </p>
        ) : (
          <div className="space-y-2">
            {visibleWorkspaces.map((ws) => {
              const isOwner = ws.created_by === user?.id;
              const isWorkedOn = !isOwner && ws.updated_by === user?.id;
              // Lock is "live" only if held by someone else and refreshed within 30 min.
              const lockFresh =
                !!ws.locked_by &&
                ws.locked_by !== user?.id &&
                !!ws.locked_at &&
                Date.now() - new Date(ws.locked_at).getTime() < ABANDONED_MS;
              return (
              <Card
                key={ws.id}
                className={cn(
                  'flex items-center justify-between p-4',
                  isOwner && 'border-l-2 border-l-primary',
                )}
              >
                {renamingId === ws.id ? (
                  <div className="flex flex-1 items-center gap-3">
                    <FolderOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <Input
                      autoFocus
                      value={renameValue}
                      disabled={renaming}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void commitRename(ws);
                        if (e.key === 'Escape') cancelRename();
                      }}
                      className="h-8 max-w-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      disabled={renaming}
                      onClick={() => void commitRename(ws)}
                      aria-label="Save name"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      disabled={renaming}
                      onClick={cancelRename}
                      aria-label="Cancel rename"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    className="flex flex-1 items-center gap-3 text-left"
                    disabled={busy}
                    onClick={() => void handleOpen(ws.id)}
                  >
                    <FolderOpen className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{ws.name}</span>
                        {isOwner && <Badge>Owner</Badge>}
                        {isWorkedOn && <Badge variant="secondary">Worked on</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Updated {new Date(ws.updated_at).toLocaleString()}
                      </div>
                    </div>
                  </button>
                )}
                {renamingId !== ws.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startRename(ws)}
                    aria-label={`Rename ${ws.name}`}
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
                {lockFresh && (
                  <span
                    className="mr-2 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"
                    title={`${ws.locked_by_email ?? 'Someone'} is editing`}
                  >
                    <Lock className="h-3 w-3" />
                    {ws.locked_by_email ?? 'Editing'}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void handleDelete(ws)}
                  aria-label={`Delete ${ws.name}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
