import { createClient } from '@supabase/supabase-js';

// The anon key is public by design — Row-Level Security in Postgres is what
// actually enforces access. Never put the service_role key in the browser.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when Supabase env vars are configured; lets the UI fail gracefully. */
export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  // Surfaced once at startup so a missing .env is obvious in dev.
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — login and cloud sync are disabled.'
  );
}

// Placeholder fallbacks keep createClient() from throwing when env is unset, so
// the app still boots and the Login page can show a "not configured" message.
// Real network calls will fail until VITE_SUPABASE_* are provided.
export const supabase = createClient(
  url || 'http://localhost:54321',
  anonKey || 'anon-placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
