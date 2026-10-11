-- F7 permission-only rollback. Restores the original effective PUBLIC EXECUTE.
-- This is an emergency compatibility rollback, not the desired final security state.
BEGIN;
SET LOCAL ROLE hod_migration;
SET LOCAL search_path = pg_catalog, public, pg_temp;

DO $f7_acl_rollback$
DECLARE
  item record;
  function_oid oid;
  function_row pg_proc%rowtype;
BEGIN
  IF current_database() <> 'hod_staging' OR current_user <> 'hod_migration' THEN
    RAISE EXCEPTION 'Use hod_staging as hod_migration';
  END IF;

  FOR item IN SELECT * FROM (VALUES
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
  ) AS planned(signature, storefront_direct)
  LOOP
    function_oid := to_regprocedure(item.signature);
    IF function_oid IS NULL THEN
      RAISE EXCEPTION 'Missing F7 function: %', item.signature;
    END IF;
    SELECT * INTO function_row FROM pg_proc WHERE oid = function_oid;
    IF NOT function_row.prosecdef
       OR function_row.proowner <> (SELECT oid FROM pg_roles WHERE rolname = 'hod_migration')
       OR function_row.proacl IS NULL
       OR has_function_privilege('anon', function_oid, 'EXECUTE')
       OR has_function_privilege('authenticated', function_oid, 'EXECUTE')
       OR has_function_privilege('hod_app', function_oid, 'EXECUTE') <> item.storefront_direct
       OR EXISTS (
         SELECT 1 FROM aclexplode(function_row.proacl) acl
         WHERE acl.grantee NOT IN (function_row.proowner, (SELECT oid FROM pg_roles WHERE rolname = 'hod_app'))
       ) THEN
      RAISE EXCEPTION 'F7 function ACL differs from expected patched state: %', item.signature;
    END IF;
  END LOOP;

  FOR item IN SELECT * FROM (VALUES
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
  ) AS planned(signature, storefront_direct)
  LOOP
    function_oid := to_regprocedure(item.signature);
    IF item.storefront_direct THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM hod_app', function_oid::regprocedure);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', function_oid::regprocedure);
  END LOOP;
END
$f7_acl_rollback$;

COMMIT;
