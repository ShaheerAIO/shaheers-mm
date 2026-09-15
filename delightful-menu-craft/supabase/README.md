# Supabase setup

The app needs a Supabase project for login, cloud storage, and the AI proxy.

## 1. Create the project

1. Create a project at [https://supabase.com/dashboard](https://supabase.com/dashboard). Production project ref: `xhfuiczcjtzukyskmdbx`.
2. **Settings → API**: copy the **Project URL** and the **anon public** key.
3. Add them to `.env.local` (see `.env.example`):
  ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
  ```

## 2. Apply the schema

In **SQL Editor → New query**, paste and run `[schema.sql](./schema.sql)`.
This creates `workspaces` + `audit_log`, RLS policies, and the audit trigger.

## 3. Microsoft 365 sign-in (Entra ID)

Sign-in is Microsoft-only — no passwords, no email/password provider.

1. **Entra app registration**: entra.microsoft.com → Entra ID → App
  registrations → New registration.
  - Name: `AIO Menu Manager`.
  - Supported account types: **Single tenant only**.
  - Redirect URI: platform **Web**, value
  `https://xhfuiczcjtzukyskmdbx.supabase.co/auth/v1/callback`.
  - Copy the **Application (client) ID** and **Directory (tenant) ID** off
  the Overview page.
2. **Client secret**: Certificates & secrets → Client secrets → New client
  secret → copy the **Value** (not the Secret ID — the Value is only shown
   once). An expired secret is a total sign-in outage with a confusing error —
   set a calendar reminder for the expiry date.
3. **API permissions**: Microsoft Graph delegated `User.Read` (default) plus
  `openid`, `email`, `profile`. Then **Grant admin consent**.
4. **Email claim**: Token configuration → Add optional claim → ID → `email`.
  Then in Manage → Manifest set `"acceptMappedClaims": true` and add the
   `xms_edov` optional claim to both `idToken` and `accessToken` (it isn't in
   the claim picker UI, only the manifest). This matters because Supabase
   rejects a sign-in it can't get a verified email for — this is the most
   common single-tenant failure.
5. **Enterprise apps → Properties → Assignment required = No** — this is what
  makes auto-provisioning work (any tenant user can sign in without being
   pre-assigned to the app).
6. **Supabase side**, in order:
  1. Run `restrict_signup_to_aio` from `[schema.sql](./schema.sql)` (re-run
    the whole file — it's idempotent).
  2. **Authentication → Hooks → Before User Created** → select
    `restrict_signup_to_aio` → enable.
  3. **Authentication → URL Configuration**: Site URL
    `https://shaheers-mm.vercel.app`; Redirect URLs
     `https://shaheers-mm.vercel.app/login`, `http://127.0.0.1:3000/login`,
     `http://localhost:3000/login`.
  4. **Authentication → Sign In / Providers → Azure**: enable, paste the
    Client ID + secret Value, Azure Tenant URL
     `https://login.microsoftonline.com/<Directory (tenant) ID>` — the
     tenant-specific URL, not `/common`. That's what limits sign-in to the
     AIO tenant.
  5. Turn **ON** "Allow new users to sign up".
  6. Turn the **Email provider OFF** — but see the cutover warning below.
   > **First-time cutover: leave the Email provider ON until Microsoft sign-in
   > has actually made you an admin.** Your password is the only escape hatch.
   > Supabase links the new Azure identity to your existing `auth.users` row when
   > the email matches and is confirmed — but it matches the literal `email`
   > claim, so if Entra returns an alias or an `.onmicrosoft.com` UPN you get a
   > *second* user row with `role = 'member'`, and `set-role` needs an admin
   > caller. Check before and after your first Microsoft sign-in:
   >
   > ```sql
   > select u.id, u.email, u.email_confirmed_at, p.role,
   >        (select array_agg(i.provider) from auth.identities i
   >         where i.user_id = u.id) as providers
   > from auth.users u
   > left join public.profiles p on p.id = u.id
   > order by u.created_at;
   > ```
   >
   > You want *one* row for your email with `providers = {email,azure}`. Two rows
   > means run the break-glass line at the bottom of `schema.sql` and work out
   > the email-claim mismatch before turning anything off.

   > **The hook, not the sign-up toggle, is what keeps registration closed.**
   > "Allow new users to sign up" is a global setting; with the hook in place,
   > any non-`aioapp.com` sign-in is rejected before a user row ever exists.
   > **Ordering matters**: enable the hook *before* turning sign-ups on. Doing
   > it the other way around leaves a window where the Email provider accepts
   > public self-signup from anyone.



## 4. AI Enhance edge function (optional but recommended)

Moves the Anthropic key off the browser.

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ai-enhance
```

JWT verification is on by default — only logged-in users can invoke it.

## 5. Roles & in-app user management

Everyone who signs in through Microsoft arrives as `member`; an admin
promotes them to `admin` from the in-app **Team** screen. Setup:

1. **Re-run** `[schema.sql](./schema.sql)` — it adds the `profiles` table, the
  auto-profile trigger, RLS, and a break-glass admin-promotion line. **Edit
   that line** to your email before running:
   ```sql
   update public.profiles set role = 'admin'
   where lower(email) = 'you@aioapp.com';
   ```
   (Existing users are backfilled into `profiles` automatically.)
2. **Deploy the user-management functions:**
  ```bash
   supabase functions deploy set-role
   supabase functions deploy remove-user
  ```
   No secret needed — they use the built-in `SUPABASE_SERVICE_ROLE_KEY` and each
   checks that the caller is an `admin`. `set-role` refuses to change your own
   role — that's the last-admin guard: the caller is a proven admin and stays
   one, so the admin count can never reach zero through the UI. `remove-user`
   also refuses to delete your own account. (Removing a user needs the
   `on delete set null` rule on `workspaces.created_by/updated_by` — re-run
   `schema.sql` to apply it.)



## Undeploying the retired functions

`create-user`, `set-password`, and `invite-user` are deleted from this repo.
`set-password` in particular was a genuine SSO bypass — it let an admin mint a
password that skips Entra MFA and conditional access. Deleting the local
directory does **not** undeploy the function from Supabase — you must also run:

```bash
supabase functions delete create-user
supabase functions delete set-password
supabase functions delete invite-user
```



## Notes

- The `anon` key is safe in the browser; RLS enforces access. **Never** put the
`service_role` key in `.env.local` or any client code.
- Two roles, assigned manually — **admin** (manage users + edit menus) and
**member** (edit menus only). Roles live in `profiles` and are **not**
client-writable — only the trigger and the service-role functions can change
them. There's no Entra group mapping; who's an admin is purely a `profiles`
row an existing admin sets from the Team screen.
- **Offboarding** happens in Entra ID, not here. Deleting a Supabase user does
**not** stick — if they still have a Microsoft account in the tenant, they
can sign in again and get re-provisioned as a fresh `member` with a new
uuid. To actually revoke access, **disable the account in Entra ID**.
`remove-user` is for resetting a mis-promoted or mis-provisioned account,
not for offboarding.
- All logged-in users can read/write every workspace. The `audit_log` records who
changed what (server-side trigger, can't be bypassed).
- Each menu build is one JSON row in `workspaces`. The client autosaves ~1.5s
after edits with an optimistic-concurrency version check (warns on conflict).

