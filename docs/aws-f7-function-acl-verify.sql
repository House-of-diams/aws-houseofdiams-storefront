-- F7 read-only permission check. Run as hod_app after a reviewed ACL migration.
BEGIN READ ONLY;

SELECT current_database() AS database_name, current_user AS database_role,
       current_setting('transaction_read_only') AS transaction_read_only;

WITH planned(signature, storefront_direct) AS (VALUES
  ('public.cancel_pending_checkout(uuid,uuid)', true),
  ('public.cancel_pending_guest_checkout(uuid,text)', true),
  ('public.claim_due_payment_recovery_actions(integer)', true),
  ('public.claim_payment_recovery_action(uuid,text,bigint,text,text)', true),
  ('public.claim_payment_webhook_event(text,text,text,text,text,jsonb)', true),
  ('public.create_pending_order_atomic(uuid,jsonb,jsonb,jsonb)', false),
  ('public.create_pending_order_v2(uuid,jsonb,jsonb,jsonb,date,date)', true),
  ('public.create_pending_order_with_customer_dates(uuid,jsonb,jsonb,jsonb,date,date)', false),
  ('public.expire_inventory_reservations(integer)', true),
  ('public.finalize_paid_order_with_coupon_secure(uuid,text,text,text,text,text,text,text,bigint,text,jsonb)', true),
  ('public.finalize_paid_order_with_inventory(uuid,text,text,text,text,text,text,text,jsonb)', false),
  ('public.finalize_paid_order_with_inventory_secure(uuid,text,text,text,text,text,text,text,bigint,text,jsonb)', false),
  ('public.guard_paid_order_inventory_reservation(uuid)', false),
  ('public.release_order_inventory_reservation(uuid)', true),
  ('public.reserve_pending_order_item()', false)
)
SELECT planned.signature, planned.storefront_direct,
       to_regprocedure(planned.signature) IS NOT NULL AS function_exists,
       CASE WHEN to_regprocedure(planned.signature) IS NOT NULL
         THEN has_function_privilege('hod_app', to_regprocedure(planned.signature), 'EXECUTE')
       END AS hod_app_can_execute,
       CASE WHEN to_regprocedure(planned.signature) IS NOT NULL
         THEN has_function_privilege('anon', to_regprocedure(planned.signature), 'EXECUTE')
       END AS anon_can_execute,
       CASE WHEN to_regprocedure(planned.signature) IS NOT NULL
         THEN has_function_privilege('authenticated', to_regprocedure(planned.signature), 'EXECUTE')
       END AS legacy_authenticated_can_execute
FROM planned ORDER BY planned.signature;

ROLLBACK;
