-- F6 CUSTOMER IDENTITY — READ-ONLY PREFLIGHT
-- Run manually against the intended RDS database after review. This file is
-- informational only; it changes no schema or data.
select current_database() as database_name, current_user as connected_role,
       current_setting('server_version') as server_version;

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'orders', 'checkout_attempts', 'carts', 'wishlists', 'coupon_redemptions')
  and column_name in ('id', 'user_id', 'email')
order by table_name, ordinal_position;

select source.relname as table_name, source_column.attname as column_name,
       target_namespace.nspname as foreign_schema, target.relname as foreign_table,
       target_column.attname as foreign_column, constraint_row.conname,
       pg_get_constraintdef(constraint_row.oid) as definition
from pg_constraint constraint_row
join pg_class source on source.oid = constraint_row.conrelid
join pg_namespace source_namespace on source_namespace.oid = source.relnamespace
join pg_class target on target.oid = constraint_row.confrelid
join pg_namespace target_namespace on target_namespace.oid = target.relnamespace
cross join lateral unnest(constraint_row.conkey, constraint_row.confkey)
  as key_columns(source_number, target_number)
join pg_attribute source_column on source_column.attrelid = source.oid
  and source_column.attnum = key_columns.source_number
join pg_attribute target_column on target_column.attrelid = target.oid
  and target_column.attnum = key_columns.target_number
where constraint_row.contype = 'f' and source_namespace.nspname = 'public'
  and source.relname in ('profiles', 'orders', 'checkout_attempts', 'carts', 'wishlists', 'coupon_redemptions')
order by source.relname, source_column.attname;

select rolname, rolsuper, rolbypassrls from pg_roles
where rolname in ('hod_app', 'hod_dev_migration', 'hod_migration');

select schemaname, tablename, policyname, roles, cmd
from pg_policies where schemaname = 'public'
  and tablename in ('customer_identities', 'customer_sessions', 'customer_profiles')
order by tablename, policyname;

select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where grantee in ('hod_app', 'hod_dev_migration')
  and table_schema = 'public'
  and table_name in ('customer_identities', 'customer_sessions', 'customer_profiles')
order by grantee, table_name, privilege_type;
