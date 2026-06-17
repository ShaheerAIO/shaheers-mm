import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, UserPlus, KeyRound, Shield, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [busy, setBusy] = useState(false);

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

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: { email: email.trim(), password, role },
    });
    setBusy(false);
    if (error || data?.error) {
      toast.error(`Could not create user: ${data?.error ?? (await fnErrorMessage(error, 'Unknown error'))}`);
      return;
    }
    toast.success(`Created ${email.trim()} as ${role}. Share the email + password with them.`);
    setEmail('');
    setPassword('');
    setRole('member');
    void refresh();
  };

  const handleSetPassword = async (row: ProfileRow) => {
    const label = row.email ?? 'this user';
    const next = prompt(`Set a new password for ${label} (min 6 characters):`);
    if (next === null) return; // cancelled
    if (next.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    const { data, error } = await supabase.functions.invoke('set-password', {
      body: { userId: row.id, password: next },
    });
    if (error || data?.error) {
      toast.error(`Could not set password: ${data?.error ?? (await fnErrorMessage(error, 'Unknown error'))}`);
      return;
    }
    toast.success(`Password updated for ${label}. Share it with them.`);
  };

  const handleRemove = async (row: ProfileRow) => {
    const label = row.email ?? 'this user';
    if (!confirm(`Remove ${label}? They lose access immediately. This cannot be undone.`)) return;
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
          className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to projects
        </button>

        <h1 className="mb-1 text-2xl font-semibold">Team</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Create accounts and manage access. Admins set the email + password directly
          (no email sent) and share the credentials with the teammate.
        </p>

        <Card className="mb-6 p-4">
          <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="email"
              placeholder="teammate@aioapp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              required
            />
            <Input
              type="text"
              placeholder="Password (min 6)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1"
              required
              minLength={6}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button type="submit" disabled={busy}>
              <UserPlus className="mr-2 h-4 w-4" /> {busy ? 'Creating…' : 'Create user'}
            </Button>
          </form>
        </Card>

        {rows === null ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <Card key={r.id} className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="truncate">{r.email ?? '(no email)'}</span>
                    {r.id === user?.id && (
                      <span className="text-xs text-muted-foreground">(you)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {r.role === 'admin' && <Shield className="h-3 w-3 text-primary" />}
                    {r.role}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => void handleSetPassword(r)}>
                    <KeyRound className="mr-2 h-4 w-4" /> Set password
                  </Button>
                  {r.id !== user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleRemove(r)}
                      aria-label={`Remove ${r.email ?? 'user'}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
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
