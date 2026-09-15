// Supabase Edge Function: set-role
// Admin-only. Verifies the CALLER is an admin (server-side, via the service
// role), then changes another user's role. Refuses to change your OWN role —
// that single rule is the last-admin guard: the caller is an admin and stays
// one, so the admin count can never reach zero.
//
// Deploy:  supabase functions deploy set-role
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

    // 2. Authorize: caller must be an admin (role read server-side, not trusted from client).
    const { data: prof } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.user.id)
      .single();
    if (prof?.role !== 'admin') return json({ error: 'Admins only.' }, 403);

    // 3. Validate input + guard against self-changes (the last-admin guard).
    const { userId, role } = await req.json();
    if (!userId || typeof userId !== 'string') return json({ error: 'userId is required.' }, 400);
    if (role !== 'admin' && role !== 'member') {
      return json({ error: 'role must be "admin" or "member".' }, 400);
    }
    if (userId === caller.user.id) {
      return json({ error: 'You cannot change your own role. Ask another admin.' }, 400);
    }

    // 4. Write it. The service role bypasses RLS on purpose: `profiles` has no
    //    client write policy, which is the privilege-escalation guard.
    const { data: updated, error: updErr } = await admin
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select('id')
      .maybeSingle();
    if (updErr) return json({ error: updErr.message }, 400);
    if (!updated) return json({ error: 'No such user.' }, 404);

    return json({ ok: true, role });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
