-- READ ONLY metadata checks after the reviewed forward migration.
-- Behavioral tests must additionally run in an isolated test database.
begin read only;

select current_user database_role, current_setting('transaction_read_only') read_only;

select column_name, data_type, is_nullable, column_default
from information_schema.columns where table_schema = 'public'
  and table_name = 'orders' and column_name = 'fulfillment_mode';

select conname, pg_get_constraintdef(oid) definition
from pg_constraint where conrelid = 'public.orders'::regclass
  and conname = 'orders_fulfillment_mode_check';

select p.proname, pg_get_userbyid(p.proowner) function_owner,
       p.prosecdef security_definer,
       position('made_to_order' in pg_get_functiondef(p.oid)) > 0 made_to_order_branch,
       has_function_privilege(current_user, p.oid, 'EXECUTE') can_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'create_pending_order_v2', 'reserve_pending_order_item',
  'apply_order_stock_on_create', 'restore_order_stock_on_cancel',
  'guard_paid_order_inventory_reservation',
  'finalize_paid_order_with_inventory_secure')
order by p.proname;

select fulfillment_mode, count(*)::bigint orders
from public.orders group by fulfillment_mode order by fulfillment_mode;

rollback;
