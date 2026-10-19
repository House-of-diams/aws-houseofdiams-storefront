-- Read-only checks for 2026101901_coupon_usage_limit. Every row must say true.
select 'function enforces usage limit' as check_name,
       position('HOD-012' in p.prosrc) > 0 and position('usage_limit' in p.prosrc) > 0 as ok
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'finalize_paid_order_with_coupon_secure'
union all
select 'function is security definer owned by hod_migration', p.prosecdef and pg_get_userbyid(p.proowner) = 'hod_migration'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'finalize_paid_order_with_coupon_secure'
union all
select 'storefront role can still execute it', has_function_privilege('hod_app', p.oid, 'EXECUTE')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'finalize_paid_order_with_coupon_secure'
union all
select 'anon cannot execute it', not has_function_privilege('anon', p.oid, 'EXECUTE')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'finalize_paid_order_with_coupon_secure'
union all
select 'pending-coupon index exists', exists(select 1 from pg_indexes where schemaname = 'public' and indexname = 'orders_pending_coupon_idx');
