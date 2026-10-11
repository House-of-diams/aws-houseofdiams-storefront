-- F7 READ ONLY. Run as hod_app against the intended database and save results
-- for review before any F7 forward SQL. This does not validate payment behavior.
begin read only;

select current_database() database_name, current_user database_role,
       current_setting('transaction_read_only') transaction_read_only;

select name, to_regclass('public.' || name) is not null as exists
from unnest(array[
  'orders', 'order_items', 'checkout_attempts', 'coupon_redemptions',
  'inventory_reservations', 'payment_webhook_events', 'payment_recovery_actions',
  'customer_identities', 'customer_sessions', 'customer_profiles',
  'catalog_categories', 'categories', 'order_status_history'
]) as name order by name;

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('orders', 'order_items', 'checkout_attempts',
    'coupon_redemptions', 'products', 'inventory_reservations')
  and column_name in ('id', 'user_id', 'guest_token_hash', 'customer_identity_id',
    'fulfillment_mode', 'stock_quantity', 'product_lane', 'payment_amount',
    'payment_currency', 'status', 'payment_status')
order by table_name, column_name;

select c.conrelid::regclass as source_table, c.conname,
       c.confrelid::regclass as target_table, pg_get_constraintdef(c.oid) definition
from pg_constraint c
where c.conrelid in ('public.orders'::regclass,
  'public.checkout_attempts'::regclass, 'public.coupon_redemptions'::regclass)
  and c.contype in ('c', 'f', 'u')
order by source_table, c.conname;

select t.tgrelid::regclass as table_name, t.tgname,
       pg_get_triggerdef(t.oid) definition,
       pg_get_userbyid(p.proowner) function_owner, p.prosecdef security_definer
from pg_trigger t join pg_proc p on p.oid = t.tgfoid
where t.tgrelid in ('public.orders'::regclass, 'public.order_items'::regclass)
  and not t.tgisinternal order by table_name, t.tgname;

select p.proname, pg_get_function_identity_arguments(p.oid) arguments,
       pg_get_userbyid(p.proowner) function_owner, p.prosecdef security_definer,
       p.proconfig, has_function_privilege(current_user, p.oid, 'EXECUTE') can_execute,
       md5(pg_get_functiondef(p.oid)) definition_md5
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'create_pending_order_v2', 'reserve_pending_order_item',
  'apply_order_stock_on_create', 'restore_order_stock_on_cancel',
  'guard_paid_order_inventory_reservation',
  'finalize_paid_order_with_inventory_secure',
  'finalize_paid_order_with_coupon_secure',
  'cancel_pending_checkout', 'cancel_pending_guest_checkout',
  'release_order_inventory_reservation', 'expire_inventory_reservations',
  'claim_payment_webhook_event', 'claim_payment_recovery_action')
order by p.proname;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' and tablename in (
  'orders', 'order_items', 'checkout_attempts', 'coupon_redemptions',
  'inventory_reservations', 'payment_webhook_events', 'payment_recovery_actions',
  'customer_identities', 'customer_sessions', 'customer_profiles')
order by tablename, policyname;

select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'hod_app'
  and table_name in ('orders', 'order_items', 'checkout_attempts',
    'coupon_redemptions', 'inventory_reservations', 'payment_webhook_events',
    'payment_recovery_actions')
order by table_name, privilege_type;

-- Existing data must be classified before any rollback plan can be approved.
select 'orders' source, count(*)::bigint rows from public.orders
union all select 'order_items', count(*) from public.order_items
union all select 'checkout_attempts', count(*) from public.checkout_attempts
union all select 'inventory_reservations', count(*) from public.inventory_reservations;

rollback;
