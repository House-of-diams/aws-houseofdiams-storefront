-- F6 CUSTOMER IDENTITY — READ-ONLY VERIFICATION
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
  and tablename in ('customer_identities', 'customer_sessions', 'customer_profiles')
order by tablename, policyname;
select to_regclass('public.customer_identities') as identities,
       to_regclass('public.customer_sessions') as sessions,
       to_regclass('public.customer_profiles') as customer_profiles;
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('customer_identities', 'customer_sessions', 'customer_profiles')
  and grantee in ('hod_app', 'hod_dev_migration', 'anon', 'authenticated', 'public')
order by table_name, grantee, privilege_type;
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('customer_identities', 'customer_sessions', 'customer_profiles')
order by tablename;
select conrelid::regclass as referencing_table, conname, confrelid::regclass as referenced_table
from pg_constraint
where contype = 'f' and confrelid in (
  'public.customer_identities'::regclass,
  'public.customer_sessions'::regclass,
  'public.customer_profiles'::regclass
);
