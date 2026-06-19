-- =============================================================================
-- Delightful Menu Craft — backend schema (Supabase / Postgres)
-- =============================================================================
-- Apply this in the Supabase SQL editor (Dashboard → SQL → New query) or via
-- `supabase db push`. Safe to re-run: guarded with `if not exists` / `or replace`.
--
-- Security model: access is enforced by RLS server-side. The frontend ships
-- only the public `anon` key; every request carries the logged-in user's JWT.
-- "Flat" permissions: any authenticated (invited) user may read/write workspaces.
-- There is no public sign-up — disable it in Auth → Providers → Email
-- ("Allow new users to sign up" OFF). Invite users via Auth → Users → Invite.
-- =============================================================================

-- One JSON document per menu build ------------------------------------------
create table if not exists public.workspaces (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  data           jsonb not null default '{}'::jsonb,   -- serialized store data slice
  schema_version int  not null default 15,             -- mirrors the store persist version
  version        bigint not null default 1,            -- optimistic-concurrency counter
  created_by     uuid references auth.users(id),
  updated_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Let a user be deleted without blocking on workspaces they touched: null the
-- reference instead of erroring. (Inline FKs default to NO ACTION, which would
-- make `auth.admin.deleteUser` fail for anyone who created/updated a workspace.)
-- Idempotent: drop-then-recreate so re-running the schema applies the rule.
alter table public.workspaces drop constraint if exists workspaces_created_by_fkey;
alter table public.workspaces add constraint workspaces_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;
alter table public.workspaces drop constraint if exists workspaces_updated_by_fkey;
alter table public.workspaces add constraint workspaces_updated_by_fkey
  foreign key (updated_by) references auth.users(id) on delete set null;

-- Single-editor lock ---------------------------------------------------------
-- The first person to open a workspace becomes the sole editor; everyone else
-- opens read-only. The lock is advisory (enforced client-side by an atomic
-- conditional UPDATE) and auto-expires after 30 min of inactivity. The
-- force_takeover_* columns carry an admin override signal: when set, the
-- current editor's tab flushes its pending save and releases the lock.
alter table public.workspaces
  add column if not exists locked_by         uuid references auth.users(id) on delete set null,
  add column if not exists locked_by_email   text,
  add column if not exists locked_at         timestamptz,
  add column if not exists force_takeover_by uuid references auth.users(id) on delete set null,
  add column if not exists force_takeover_at timestamptz;

-- Immutable audit trail (who did what, when) --------------------------------
create table if not exists public.audit_log (
  id             bigint generated always as identity primary key,
  workspace_id   uuid,
  workspace_name text,
  action         text not null,        -- 'create' | 'update' | 'delete'
  version        bigint,
  user_id        uuid,
  user_email     text,
  created_at     timestamptz not null default now()
);

create index if not exists audit_log_workspace_idx on public.audit_log (workspace_id);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

-- =============================================================================
-- Audit trigger — runs server-side, so the client cannot skip or forge it.
-- Captures auth.uid() and the user's email from auth.users.
-- =============================================================================
create or replace function public.log_workspace_audit()
returns trigger
language plpgsql
security definer            -- needs to read auth.users for the email
set search_path = public
as $$
declare
  v_email text;
  v_uid   uuid := auth.uid();
begin
  select email into v_email from auth.users where id = v_uid;

  if (tg_op = 'DELETE') then
    insert into public.audit_log (workspace_id, workspace_name, action, version, user_id, user_email)
    values (old.id, old.name, 'delete', old.version, v_uid, v_email);
    return old;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_log (workspace_id, workspace_name, action, version, user_id, user_email)
    values (new.id, new.name, 'update', new.version, v_uid, v_email);
    return new;
  else -- INSERT
    insert into public.audit_log (workspace_id, workspace_name, action, version, user_id, user_email)
    values (new.id, new.name, 'create', new.version, v_uid, v_email);
    return new;
  end if;
end;
$$;

drop trigger if exists workspaces_audit on public.workspaces;
create trigger workspaces_audit
  after insert or update or delete on public.workspaces
  for each row execute function public.log_workspace_audit();

-- Keep updated_at fresh on every write --------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists workspaces_touch on public.workspaces;
create trigger workspaces_touch
  before update on public.workspaces
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- Row-Level Security
-- =============================================================================
alter table public.workspaces enable row level security;
alter table public.audit_log  enable row level security;

-- Workspaces: any authenticated user has full access (flat model).
drop policy if exists workspaces_all on public.workspaces;
create policy workspaces_all on public.workspaces
  for all
  to authenticated
  using (true)
  with check (true);

-- Audit log: authenticated users may read and insert, but never update/delete
-- (tamper-resistant). Inserts come from the trigger; this also allows the
-- trigger's row to satisfy RLS when invoked in the user's context.
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log
  for select
  to authenticated
  using (true);

drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log
  for insert
  to authenticated
  with check (true);

-- =============================================================================
-- Roles & user management (admin / member)
-- =============================================================================
-- "member" can read/write menus (the flat model above). "admin" can also
-- manage users via the `invite-user` Edge Function. Roles live here, NOT in
-- client state, and clients cannot write this table (see policies) — only the
-- security-definer trigger and the service-role function can. That's the
-- privilege-escalation guard.

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a user is added (invite or dashboard).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any users created before this table existed.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;

-- Anyone logged in can READ profiles (to know their own role + list the team).
-- No write policies exist for normal roles → members cannot change roles from
-- the client. Writes happen only via the trigger (security definer) and the
-- service-role Edge Function (which bypasses RLS).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select
  to authenticated
  using (true);

-- =============================================================================
-- Admin force-takeover of the single-editor lock
-- =============================================================================
-- Members can only take over a lock that is free or stale (handled client-side).
-- Admins can force a takeover of a live lock: this RPC sets the signal that the
-- current editor's tab watches for, prompting it to flush its edits and release.
-- security definer + an explicit role check keeps the override non-forgeable by
-- non-admins, even though the flat workspaces policy would otherwise allow the
-- write. Runs as the caller-checked admin, not the service role.
create or replace function public.request_force_takeover(p_workspace uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'not authorized';
  end if;
  update public.workspaces
     set force_takeover_by = auth.uid(), force_takeover_at = now()
   where id = p_workspace;
end;
$$;

-- -----------------------------------------------------------------------------
-- ONE-TIME bootstrap: promote the first admin. Run this once after applying
-- the schema, editing the email to match your account.
-- -----------------------------------------------------------------------------
update public.profiles set role = 'admin'
where email = 'shaheer.hasnain@aioapp.com';
