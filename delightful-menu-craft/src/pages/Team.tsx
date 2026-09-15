import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Search, Shield, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAuth, type UserRole } from '@/contexts/AuthContext';

interface ProfileRow {
  id: string;
  email: string | null;
  role: UserRole;
  created_at: string;
}

/** supabase-js hides a function's real message in error.context (the Response). */
async function fnErrorMessage(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch {
      /* body wasn't JSON */
    }
  }
  return (error as Error)?.message ?? fallback;
}

export default function Team() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<ProfileRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [savingRole, setSavingRole] = useState<string | null>(null);

  const refresh = () =>
    supabase
      .from('profiles')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error(`Could not load team: ${error.message}`);
        setRows((data ?? []) as ProfileRow[]);
      });

  useEffect(() => {
    void refresh();
  }, []);

  const query = search.trim().toLowerCase();
  const visibleRows = useMemo(() => {
    if (!rows) return [];
    if (!query) return rows;
    return rows.filter((r) => {
      const haystack = [r.email ?? '', r.role, r.id === user?.id ? 'you' : '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, query, user?.id]);

  const handleSetRole = async (row: ProfileRow, next: UserRole) => {
    if (next === row.role) return;
    setSavingRole(row.id);
    const { data, error } = await supabase.functions.invoke('set-role', {
      body: { userId: row.id, role: next },
    });
    setSavingRole(null);
    if (error || data?.error) {
      toast.error(`Could not change role: ${data?.error ?? (await fnErrorMessage(error, 'Unknown error'))}`);
      return;
    }
    toast.success(
      `${row.email ?? 'User'} is now ${next === 'admin' ? 'an admin' : 'a member'}. They will see the change after a reload.`
    );
    void refresh();
  };

  const handleRemove = async (row: ProfileRow) => {
    const label = row.email ?? 'this user';
    if (!confirm(
      `Remove ${label}? This signs them out and clears their role. ` +
      `If their AIO Microsoft account is still active they can sign back in as a member — ` +
      `disable them in Entra ID to revoke access for good.`
    )) return;
    const { data, error } = await supabase.functions.invoke('remove-user', {
      body: { userId: row.id },
    });
    if (error || data?.error) {
      toast.error(`Could not remove: ${data?.error ?? (await fnErrorMessage(error, 'Unknown error'))}`);
      return;
    }
    toast.success(`Removed ${label}.`);
    void refresh();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => navigate('/workspaces')}
          className="mb-4 flex items-center gap-2 text-[13px] text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back to projects
        </button>

        <span className="aio-eyebrow">Access</span>
        <h1 className="aio-h1 mt-1">
          {rows === null ? 'Loading the team…' : query ? (
            <><b>{visibleRows.length} {visibleRows.length === 1 ? 'person' : 'people'}</b> {visibleRows.length === 1 ? 'matches' : 'match'}</>
          ) : (
            <><b>{rows.length} {rows.length === 1 ? 'person' : 'people'}</b> can sign in</>
          )}
        </h1>
        <p className="aio-sub mb-6 mt-1">
          Anyone with an AIO Microsoft account can sign in and starts as a member. Promote someone to
          admin here — admins manage access and can force a hand-over of a locked project.
        </p>

        {rows !== null && rows.length > 0 && (
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              placeholder="Search people…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-8"
              aria-label="Search people"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint transition-colors hover:text-ink"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {rows === null ? (
          <div className="flex justify-center py-12 text-ink-faint">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <p className="text-[14px] font-semibold text-ink">No one has signed in yet</p>
            <p className="aio-sub">People appear here after they sign in with an AIO Microsoft account.</p>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 text-ink-faint">
              <Search className="h-5 w-5" />
            </span>
            <p className="text-[14px] font-semibold text-ink">Nothing matches that search</p>
            <p className="aio-sub">Try a different email or role.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleRows.map((r) => (
              <Card key={r.id} className="flex items-center justify-between p-4 aio-card-hover">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[14px] font-medium text-ink">
                    <span className="truncate">{r.email ?? '(no email)'}</span>
                    {r.id === user?.id && <span className="text-[11px] text-ink-faint">(you)</span>}
                  </div>
                  <div className="mt-1">
                    {r.id === user?.id ? (
                      r.role === 'admin' ? (
                        <span className="aio-chip accent"><Shield className="h-3 w-3" /> Admin</span>
                      ) : (
                        <span className="aio-chip">Member</span>
                      )
                    ) : (
                      <select
                        value={r.role}
                        disabled={savingRole === r.id}
                        onChange={(e) => void handleSetRole(r, e.target.value as UserRole)}
                        aria-label={`Role for ${r.email ?? 'user'}`}
                        className="h-8 rounded-[var(--aio-r-2)] border border-[var(--aio-border)] bg-surface px-2 text-[12px] font-medium text-ink transition-colors hover:border-rule-2 disabled:opacity-60"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {r.id !== user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleRemove(r)}
                      aria-label={`Remove ${r.email ?? 'user'}`}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
