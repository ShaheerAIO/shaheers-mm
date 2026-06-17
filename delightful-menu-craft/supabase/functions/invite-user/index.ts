// Supabase Edge Function: invite-user
// Admin-only. Verifies the CALLER is an admin (server-side, via the service
// role), then invites a new user by email and sets their role. The service_role
// key never leaves the server — it's auto-injected into deployed functions.
//
// Deploy:  supabase functions deploy invite-user
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

    // 3. Validate input.
    const { email, role, redirectTo } = await req.json();
    if (!email || typeof email !== 'string') return json({ error: 'Email is required.' }, 400);
    const newRole = role === 'admin' ? 'admin' : 'member';

    // 4. Invite. The handle_new_user trigger creates the profile row (role 'member').
    const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: typeof redirectTo === 'string' ? redirectTo : undefined,
    });
    if (invErr || !invited.user) {
      return json({ error: invErr?.message ?? 'Invite failed.' }, 400);
    }

    // 5. Promote to admin if requested.
    if (newRole === 'admin') {
      const { error: roleErr } = await admin
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', invited.user.id);
      if (roleErr) return json({ error: `Invited, but role update failed: ${roleErr.message}` }, 500);
    }

    return json({ ok: true, userId: invited.user.id, role: newRole });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
