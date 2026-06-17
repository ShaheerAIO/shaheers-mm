// Supabase Edge Function: set-password
// Admin-only. Verifies the CALLER is an admin (server-side, via the service
// role), then sets a new password for a user directly — no reset email is sent.
//
// Deploy:  supabase functions deploy set-password
// (No manual secret needed: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are built in.)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Missing authorization token.' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Identify the caller from their JWT.
    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller.user) return json({ error: 'Invalid session.' }, 401);

    // 2. Authorize: caller must be an admin.
    const { data: prof } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.user.id)
      .single();
    if (prof?.role !== 'admin') return json({ error: 'Admins only.' }, 403);

    // 3. Validate input.
    const { userId, password } = await req.json();
    if (!userId || typeof userId !== 'string') return json({ error: 'userId is required.' }, 400);
    if (!password || typeof password !== 'string' || password.length < 6) {
      return json({ error: 'Password must be at least 6 characters.' }, 400);
    }

    // 4. Set the new password directly.
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password });
    if (updErr) return json({ error: updErr.message }, 400);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
