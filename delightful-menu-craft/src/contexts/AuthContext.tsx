import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { leaveWorkspace } from '@/lib/workspaceSync';

export type UserRole = 'admin' | 'member';

// The OAuth round-trip leaves and re-enters the app, so the deep link the user
// originally asked for can't ride on router state. Same tab => sessionStorage.
const REDIRECT_KEY = 'mm.auth.redirect';

/** Read-and-clear the path to return to after a Microsoft sign-in. */
export function takeAuthRedirect(): string {
  const target = sessionStorage.getItem(REDIRECT_KEY);
  sessionStorage.removeItem(REDIRECT_KEY);
  return target || '/';
}

interface AuthContextValue {
  user: User | null;
  role: UserRole | null;
  isAdmin: boolean;
  loading: boolean; // true until the initial session AND role check resolve
  signInWithMicrosoft: (from: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchRole(userId: string): Promise<UserRole | null> {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
  // A silent failure here degrades an admin to member-level UI, so say so.
  if (error) console.error('[auth] could not load role', error);
  return (data?.role as UserRole | undefined) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Resolve role before clearing `loading` so route guards don't flicker.
    const resolve = async (s: Session | null) => {
      setSession(s);
      setRole(s?.user ? await fetchRole(s.user.id) : null);
    };

    supabase.auth.getSession().then(async ({ data }) => {
      await resolve(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      void resolve(newSession);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithMicrosoft: AuthContextValue['signInWithMicrosoft'] = async (from) => {
    sessionStorage.setItem(REDIRECT_KEY, from);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        // Supabase Auth requires Azure to return an email; GoTrue adds `openid`
        // itself. No `offline_access` — we never call Microsoft Graph.
        scopes: 'email',
        // Must be allow-listed in Supabase → Authentication → URL Configuration.
        redirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) sessionStorage.removeItem(REDIRECT_KEY);
    // On success the browser navigates away; only failures return here.
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    // Release any held edit lock while the JWT is still valid, then sign out.
    await leaveWorkspace();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        role,
        isAdmin: role === 'admin',
        loading,
        signInWithMicrosoft,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
