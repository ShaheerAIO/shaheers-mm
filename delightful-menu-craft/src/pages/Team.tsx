import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Mail, KeyRound, Shield } from 'lucide-react';
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

export default function Team() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<ProfileRow[] | null>(null);
  const [email, setEmail] = useState('');
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

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email: email.trim(), role, redirectTo: `${window.location.origin}/set-password` },
    });
    setBusy(false);
    if (error || data?.error) {
      toast.error(`Invite failed: ${data?.error ?? error?.message}`);
      return;
    }
    toast.success(`Invited ${email.trim()} as ${role}.`);
    setEmail('');
    setRole('member');
    void refresh();
  };

  const handleReset = async (targetEmail: string | null) => {
    if (!targetEmail) return;
    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: `${window.location.origin}/set-password`,
    });
    if (error) toast.error(error.message);
    else toast.success(`Password reset email sent to ${targetEmail}.`);
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
          Invite teammates and manage access. Admins can invite users and reset passwords.
        </p>

        <Card className="mb-6 p-4">
          <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="email"
              placeholder="teammate@aioapp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              required
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
              <Mail className="mr-2 h-4 w-4" /> {busy ? 'Inviting…' : 'Invite'}
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
                <Button variant="ghost" size="sm" onClick={() => void handleReset(r.email)}>
                  <KeyRound className="mr-2 h-4 w-4" /> Reset password
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
