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
Admins can invite users and reset passwords from the in-app **Team** screen
(no dashboard needed). Setup:

1. **Re-run [`schema.sql`](./schema.sql)** — it adds the `profiles` table, the
   auto-profile trigger, RLS, and a one-time bootstrap line. **Edit that bootstrap
   line** to your email before running:
   ```sql
   update public.profiles set role = 'admin' where email = 'YOU@aioapp.com';
   ```
   (Existing users are backfilled into `profiles` automatically.)
2. **Auth → URL Configuration:** add your app origin and the set-password path to
   **Redirect URLs**, e.g. `http://localhost:3000/set-password` and your prod URL.
3. **Auth → SMTP (Project Settings → Auth):** configure an SMTP sender so invite
   and password-reset emails actually send. The built-in sender works but is
   rate-limited (~few/hour) and may land in spam.
4. **Deploy the invite function:**
   ```bash
   supabase functions deploy invite-user
   ```
   No secret needed — it uses the built-in `SUPABASE_SERVICE_ROLE_KEY`. It checks
   that the caller is an `admin` before inviting.

How it works: invite a teammate (choosing **member** or **admin**) → they get an
email → the link lands on `/set-password` where they pick a password → done.
Inviting someone as **admin** lets them invite others too.

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
