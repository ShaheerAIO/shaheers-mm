# Supabase setup

The app needs a Supabase project for login, cloud storage, and the AI proxy.

## 1. Create the project
1. Create a project at https://supabase.com/dashboard.
2. **Settings → API**: copy the **Project URL** and the **anon public** key.
3. Add them to `.env.local` (see `.env.example`):
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

## 2. Apply the schema
In **SQL Editor → New query**, paste and run [`schema.sql`](./schema.sql).
This creates `workspaces` + `audit_log`, RLS policies, and the audit trigger.

## 3. Lock down sign-up (invite-only)
**Authentication → Providers → Email**: turn **OFF** "Allow new users to sign up".
Add teammates via **Authentication → Users → Add user / Invite**.

## 4. AI Enhance edge function (optional but recommended)
Moves the Anthropic key off the browser.
```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ai-enhance
```
JWT verification is on by default — only logged-in users can invoke it.

## 5. Roles & in-app user management
Admins manage accounts from the in-app **Team** screen — fully email-free, so no
SMTP setup is required. Setup:

1. **Re-run [`schema.sql`](./schema.sql)** — it adds the `profiles` table, the
   auto-profile trigger, RLS, and a one-time bootstrap line. **Edit that bootstrap
   line** to your email before running:
   ```sql
   update public.profiles set role = 'admin' where email = 'YOU@aioapp.com';
   ```
   (Existing users are backfilled into `profiles` automatically.)
2. **Deploy the user-management functions:**
   ```bash
   supabase functions deploy create-user
   supabase functions deploy set-password
   supabase functions deploy remove-user
   ```
   No secret needed — they use the built-in `SUPABASE_SERVICE_ROLE_KEY` and each
   checks that the caller is an `admin`. `remove-user` also refuses to delete your
   own account. (Removing a user needs the `on delete set null` rule on
   `workspaces.created_by/updated_by` — re-run `schema.sql` to apply it.)

How it works: an admin enters an email + password (and **member**/**admin**) →
`create-user` makes a pre-confirmed account, no email sent → the admin shares the
credentials with the teammate, who logs in immediately. "Set password" lets an
admin reset anyone's password directly. Creating someone as **admin** lets them
manage users too.

> Email-free by design — `invite-user` (the old emailed-invite function) is no
> longer used. SMTP is optional; only configure it if you later want emailed
> invites or self-service password resets.

## Notes
- The `anon` key is safe in the browser; RLS enforces access. **Never** put the
  `service_role` key in `.env.local` or any client code.
- Two roles: **admin** (manage users + edit menus) and **member** (edit menus
  only). Roles live in `profiles` and are **not** client-writable — only the
  trigger and the service-role function can change them, so a member can't
  escalate themselves from the browser.
- All logged-in users can read/write every workspace. The `audit_log` records who
  changed what (server-side trigger, can't be bypassed).
- Each menu build is one JSON row in `workspaces`. The client autosaves ~1.5s
  after edits with an optimistic-concurrency version check (warns on conflict).
- Promoting an *existing* member to admin isn't in the UI — do it with one line:
  `update public.profiles set role='admin' where email='…';`
