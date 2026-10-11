-- Staging-only F7 prerequisite. Run once as hod_dev_migration, NOT hod_migration
-- or hod_app. Grants only FK creation rights on the identity primary key to
-- the no-login migration owner. No SELECT, auth-schema access, or row changes.
begin;

do $f7_reference_guard$
begin
  if current_database() <> 'hod_staging' or current_user <> 'hod_dev_migration' then
    raise exception 'Expected hod_staging as hod_dev_migration';
  end if;
  if to_regclass('public.customer_identities') is null then
    raise exception 'Customer identity table is unavailable';
  end if;
  if not exists (
    select 1 from pg_class c
    where c.oid = 'public.customer_identities'::regclass
      and pg_get_userbyid(c.relowner) = current_user
  ) then
    raise exception 'Customer identity table owner differs';
  end if;
  if not exists (
    select 1 from pg_constraint k
    where k.conrelid = 'public.customer_identities'::regclass
      and k.contype = 'p'
      and pg_get_constraintdef(k.oid) = 'PRIMARY KEY (id)'
  ) then
    raise exception 'Customer identity primary key differs';
  end if;
  if has_column_privilege('hod_migration', 'public.customer_identities', 'id', 'REFERENCES') then
    raise exception 'Migration role already has REFERENCES; inspect before retry';
  end if;
end
$f7_reference_guard$;

grant references (id) on table public.customer_identities to hod_migration;

commit;
