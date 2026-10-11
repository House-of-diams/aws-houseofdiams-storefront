-- READ ONLY metadata verification after reviewed ownership migration.
-- Does not prove application-level session ownership or payment behavior.
begin read only;

select current_user database_role, current_setting('transaction_read_only') read_only;

-- Use pg_catalog: hod_app intentionally has no direct SELECT grant on
-- coupon_redemptions, so information_schema.columns hides that table.
select c.relname table_name, a.attname column_name,
       format_type(a.atttypid, a.atttypmod) data_type,
       not a.attnotnull is_nullable
from pg_attribute a join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('orders', 'checkout_attempts', 'coupon_redemptions')
  and a.attname in ('user_id', 'guest_token_hash', 'customer_identity_id')
  and not a.attisdropped
order by c.relname, a.attname;

select conrelid::regclass source_table, conname,
       confrelid::regclass target_table, pg_get_constraintdef(oid) definition
from pg_constraint where conrelid in ('public.orders'::regclass,
  'public.checkout_attempts'::regclass, 'public.coupon_redemptions'::regclass)
  and (conname like '%owner_check' or confrelid = 'public.customer_identities'::regclass)
order by source_table, conname;

select tablename, indexname, indexdef from pg_indexes
where schemaname = 'public' and indexname in (
  'orders_customer_identity_id_idx',
  'checkout_attempts_customer_idempotency_uidx',
  'coupon_redemptions_customer_identity_id_idx')
order by tablename, indexname;

select tablename, policyname, roles, cmd from pg_policies
where schemaname = 'public' and policyname like 'hod_app_f7_%'
order by tablename, policyname;

select 'checkout_result_page' table_name, count(*)::bigint visible_rows
from public.checkout_result_page where is_enabled = true
union all
select 'checkout_result_states', count(*)::bigint
from public.checkout_result_states where is_enabled = true;

select table_name, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'hod_app'
  and table_name in ('orders', 'order_items', 'checkout_attempts',
    'coupon_redemptions', 'inventory_reservations',
    'payment_webhook_events', 'payment_recovery_actions')
order by table_name, privilege_type;

select proname,
  position('v_customer_identity_id' in pg_get_functiondef(p.oid)) > 0 customer_owner_path,
  position('v_order.customer_identity_id' in pg_get_functiondef(p.oid)) > 0 redemption_owner_path
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'create_pending_order_v2', 'finalize_paid_order_with_coupon_secure');

rollback;
