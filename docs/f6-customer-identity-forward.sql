-- F6 CUSTOMER IDENTITY — PROPOSAL ONLY. DO NOT APPLY UNTIL REVIEWED.
-- App-owned identity is deliberately separate from auth.users and profiles.id.
-- It preserves existing admin/profile records and does not remap commerce FKs.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $guard$
begin
  if current_user = 'hod_app' then
    raise exception 'Use the reviewed migration role, never the application role';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'hod_app' and not rolsuper and not rolbypassrls) then
    raise exception 'hod_app must exist without superuser or BYPASSRLS';
  end if;
end
$guard$;

create table public.customer_identities (
  id uuid primary key default gen_random_uuid(),
  issuer text not null check (issuer ~ '^https://[^/]+/realms/hod-customers$'),
  subject text not null check (length(subject) between 1 and 255),
  email text not null,
  email_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issuer, subject),
  check (email = lower(btrim(email)))
);

create table public.customer_sessions (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.customer_identities(id) on delete cascade,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index customer_sessions_expiry_idx on public.customer_sessions (expires_at);

create table public.customer_profiles (
  identity_id uuid primary key references public.customer_identities(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  birth_date date,
  anniversary_date date,
  country text,
  state text,
  district text,
  city text,
  postal_code text,
  address_line_1 text,
  address_line_2 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_identities enable row level security;
alter table public.customer_sessions enable row level security;
alter table public.customer_profiles enable row level security;
revoke all on public.customer_identities, public.customer_sessions, public.customer_profiles from public, anon, authenticated;
grant select, insert, update on public.customer_identities to hod_app;
grant select, insert, update, delete on public.customer_sessions to hod_app;
grant select, insert, update on public.customer_profiles to hod_app;

-- The trusted server role can manage customer rows. Browser/anonymous roles
-- receive no policy. Every application query must enforce session ownership;
-- these policies do not themselves provide per-customer isolation.
create policy hod_app_customer_identities_select on public.customer_identities for select to hod_app using (true);
create policy hod_app_customer_identities_insert on public.customer_identities for insert to hod_app with check (true);
create policy hod_app_customer_identities_update on public.customer_identities for update to hod_app using (true) with check (true);
create policy hod_app_customer_sessions_select on public.customer_sessions for select to hod_app using (true);
create policy hod_app_customer_sessions_insert on public.customer_sessions for insert to hod_app with check (true);
create policy hod_app_customer_sessions_update on public.customer_sessions for update to hod_app using (true) with check (true);
create policy hod_app_customer_sessions_delete on public.customer_sessions for delete to hod_app using (true);
create policy hod_app_customer_profiles_select on public.customer_profiles for select to hod_app using (true);
create policy hod_app_customer_profiles_insert on public.customer_profiles for insert to hod_app with check (true);
create policy hod_app_customer_profiles_update on public.customer_profiles for update to hod_app using (true) with check (true);

commit;
