import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth, takeAuthRedirect } from '@/contexts/AuthContext';
import { isSupabaseConfigured, oauthError } from '@/lib/supabase';

/** Microsoft's four-square mark. lucide ships no brand logos, and Microsoft's
 *  sign-in branding requires the mark alongside the label. The Button's
 *  `[&_svg]:size-4` sizes it. */
function MicrosoftMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="0" y="0" width="7" height="7" fill="#F25022" />
      <rect x="9" y="0" width="7" height="7" fill="#7FBA00" />
      <rect x="0" y="9" width="7" height="7" fill="#00A4EF" />
      <rect x="9" y="9" width="7" height="7" fill="#FFB900" />
    </svg>
  );
}

export default function Login() {
  const { user, loading, signInWithMicrosoft } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);

  // Where to send the user after login (set by RequireAuth on the bounce).
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  // PKCE returns to /login?code=… — supabase-js exchanges it in the background.
  const [exchanging, setExchanging] = useState(() =>
    new URLSearchParams(location.search).has('code')
  );

  // Surface an Entra / auth-hook rejection (e.g. a non-aioapp.com account).
  useEffect(() => {
    if (oauthError) toast.error(oauthError);
  }, []);

  // A successful exchange fires SIGNED_IN and the effect below navigates away.
  // A failed one (stale code, PKCE verifier from another browser) fires nothing
  // at all — so time the spinner out rather than hanging on the only way in.
  useEffect(() => {
    if (!exchanging) return;
    const t = setTimeout(() => {
      setExchanging(false);
      toast.error('Sign-in did not complete. Please try again.');
    }, 8000);
    return () => clearTimeout(t);
  }, [exchanging]);

  // Fires both on the OAuth return and when an already-signed-in user hits
  // /login directly — this route has no guard of its own.
  useEffect(() => {
    if (loading || !user) return;
    navigate(takeAuthRedirect(), { replace: true });
  }, [loading, user, navigate]);

  if (loading || exchanging || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-ink-faint" />
      </div>
    );
  }

  const handleSignIn = async () => {
    setBusy(true);
    const { error } = await signInWithMicrosoft(from);
    if (error) {
      setBusy(false);
      toast.error(error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex flex-col gap-1.5">
          <div className="text-[18px] tracking-tight">
            <span className="brand-aio">AIO</span>{' '}
            <span className="font-semibold text-ink">Menu Manager</span>
          </div>
          <p className="aio-sub">Build a menu once, ship it to every channel.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your AIO Microsoft account.</CardDescription>
          </CardHeader>
          <CardContent>
            {!isSupabaseConfigured && (
              <p className="mb-4 rounded-[var(--aio-r-2)] border border-danger-edge bg-danger-bg p-3 text-[13px] text-danger">
                Supabase is not configured. Set <code>VITE_SUPABASE_URL</code> and{' '}
                <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code>.
              </p>
            )}
            <Button
              variant="secondary"
              className="h-10 w-full border-[var(--aio-border)] hover:border-rule-2"
              onClick={() => void handleSignIn()}
              disabled={busy || !isSupabaseConfigured}
            >
              <MicrosoftMark />
              {busy ? 'Redirecting to Microsoft…' : 'Continue with Microsoft'}
            </Button>
            <p className="mt-3 text-center text-[12px] text-ink-faint">
              Only aioapp.com accounts can sign in. Your account is set up on first sign-in.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
