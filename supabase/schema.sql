-- URUSS Q4 Campaign 2026
-- Run this entire script in Supabase > SQL Editor > New query.
-- Creates the live public reporting tables, protected admin rights, and audit logs.
-- Safe to rerun without wiping report data. No service-role key is needed in Next.js.

begin;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_settings (
  id integer primary key default 1 check (id = 1),
  title text not null check (char_length(title) between 1 and 90),
  period_label text not null check (char_length(period_label) between 1 and 50),
  campaign_tagline text not null default '' check (char_length(campaign_tagline) <= 140),
  target_collection numeric(15,2) not null check (target_collection > 0),
  number_of_files integer not null check (number_of_files >= 0),
  starts_on date not null,
  ends_on date not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint valid_campaign_dates check (ends_on >= starts_on)
);

create table if not exists public.daily_snapshots (
  report_date date primary key,
  -- CUMULATIVE amount collected as of this reporting date (not daily collections).
  collection_as_of_date numeric(15,2) check (collection_as_of_date >= 0),
  -- Only files disbursed on the specified date (not cumulative).
  disbursed_files integer check (disbursed_files >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint report_contains_value check (collection_as_of_date is not null or disbursed_files is not null)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_key text not null,
  action text not null,
  actor_id uuid,
  created_at timestamptz not null default now(),
  changes jsonb
);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- The initial values come from the supplied campaign draft.
-- The collection amount was unspecified, so it is intentionally NULL, not fake RM XXXX.
insert into public.campaign_settings (
  id, title, period_label, campaign_tagline, target_collection,
  number_of_files, starts_on, ends_on
) values (
  1, 'Q4 CAMPAIGN 2026', 'NOVEMBER 2026',
  'One team. One target. Stronger together.', 4000000.00,
  200, '2026-11-05', '2027-01-03'
) on conflict (id) do nothing;

insert into public.daily_snapshots (report_date, collection_as_of_date, disbursed_files)
values ('2026-11-05', null, 22)
on conflict (report_date) do nothing;

-- Admin role is determined in the database, not by a client-side email check.
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.set_row_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

-- Audit entries are written by DB triggers. Clients cannot forge them.
create or replace function public.write_campaign_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  record_id text;
  payload jsonb;
begin
  if tg_op = 'DELETE' then
    record_id := coalesce(to_jsonb(old)->>'id', to_jsonb(old)->>'report_date');
    payload = jsonb_build_object('before', to_jsonb(old));
  else
    record_id := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'report_date');
    payload = jsonb_build_object('after', to_jsonb(new));
    if tg_op = 'UPDATE' then
      payload = payload || jsonb_build_object('before', to_jsonb(old));
    end if;
  end if;
  insert into public.audit_logs(table_name, record_key, action, actor_id, changes)
  values (tg_table_name, record_id, tg_op, auth.uid(), payload);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Idempotent triggers: re-running the schema does not duplicate triggers.
drop trigger if exists campaign_metadata on public.campaign_settings;
create trigger campaign_metadata before insert or update on public.campaign_settings
for each row execute function public.set_row_metadata();
drop trigger if exists daily_metadata on public.daily_snapshots;
create trigger daily_metadata before insert or update on public.daily_snapshots
for each row execute function public.set_row_metadata();
drop trigger if exists campaign_audit on public.campaign_settings;
create trigger campaign_audit after insert or update or delete on public.campaign_settings
for each row execute function public.write_campaign_audit();
drop trigger if exists daily_audit on public.daily_snapshots;
create trigger daily_audit after insert or update or delete on public.daily_snapshots
for each row execute function public.write_campaign_audit();

alter table public.admin_users enable row level security;
alter table public.campaign_settings enable row level security;
alter table public.daily_snapshots enable row level security;
alter table public.audit_logs enable row level security;

-- Admin role membership can be read by the owning logged-in user, not edited from browser.
drop policy if exists "Admin can see own role" on public.admin_users;
create policy "Admin can see own role" on public.admin_users
for select to authenticated using (user_id = (select auth.uid()));

-- Public displays only need READ. Both anon and authenticated can display metrics.
drop policy if exists "Public can read campaign" on public.campaign_settings;
create policy "Public can read campaign" on public.campaign_settings
for select to anon, authenticated using (true);
drop policy if exists "Admins can insert campaign" on public.campaign_settings;
create policy "Admins can insert campaign" on public.campaign_settings
for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "Admins can update campaign" on public.campaign_settings;
create policy "Admins can update campaign" on public.campaign_settings
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Public can read reports" on public.daily_snapshots;
create policy "Public can read reports" on public.daily_snapshots
for select to anon, authenticated using (true);
drop policy if exists "Admins can insert reports" on public.daily_snapshots;
create policy "Admins can insert reports" on public.daily_snapshots
for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "Admins can update reports" on public.daily_snapshots;
create policy "Admins can update reports" on public.daily_snapshots
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Audit entries are read-only for admins. No user insert/update/delete policies.
drop policy if exists "Admins can read audit log" on public.audit_logs;
create policy "Admins can read audit log" on public.audit_logs
for select to authenticated using ((select public.is_admin()));

-- Ensure API privileges match RLS. Do not grant anon write access.
grant usage on schema public to anon, authenticated;
grant select on public.campaign_settings, public.daily_snapshots to anon, authenticated;
grant insert, update on public.campaign_settings, public.daily_snapshots to authenticated;
revoke delete on public.campaign_settings, public.daily_snapshots from authenticated;
grant select on public.admin_users, public.audit_logs to authenticated;
revoke all on public.admin_users from anon;
revoke all on public.audit_logs from anon;
revoke insert, update, delete on public.admin_users from authenticated;
revoke insert, update, delete on public.audit_logs from authenticated;

-- Realtime: public dashboard receives Postgres changes without a reload.
-- This is in addition to the 30-second polling fallback in the app.
do $$ begin
  alter publication supabase_realtime add table public.campaign_settings;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.daily_snapshots;
exception when duplicate_object then null;
end $$;

commit;

-- AFTER running this script:
-- 1. Supabase Dashboard > Authentication > Users > Add user (choose admin email + password).
-- 2. Run this query with your actual admin email (replace the email string):
--    insert into public.admin_users(user_id, email)
--    select id, email from auth.users where email = 'ADMIN_EMAIL_HERE'
--    on conflict (user_id) do update set email = excluded.email;
-- 3. Add Supabase URL + anon/publishable key in .env.local or Vercel Environment Variables.
-- 4. Set Supabase Auth > URL Configuration > Site URL and Redirect URLs to your deployed URL
--    (and http://localhost:3000/admin/reset-password in development).
