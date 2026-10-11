-- F7 permission-only proposal. Run on hod_staging using a login that can
-- SET ROLE hod_migration (for example hod_dev_migration). No table/data changes.
BEGIN;
SET LOCAL ROLE hod_migration;
SET LOCAL search_path = pg_catalog, public, pg_temp;

DO $f7_acl$
DECLARE
  item record;
  function_oid oid;
  function_row pg_proc%rowtype;
BEGIN
  IF current_database() <> 'hod_staging' OR current_user <> 'hod_migration' THEN
    RAISE EXCEPTION 'Use hod_staging as hod_migration';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hod_app' AND rolcanlogin AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'hod_app role state changed';
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
       OR function_row.proacl IS NOT NULL THEN
      RAISE EXCEPTION 'Owner, SECURITY DEFINER, or ACL differs from audit: %', item.signature;
    END IF;
  END LOOP;

  -- Repeat the same fixed list only after every preflight check passes.
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
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', function_oid::regprocedure);
    IF item.storefront_direct THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO hod_app', function_oid::regprocedure);
    END IF;
  END LOOP;
END
$f7_acl$;

COMMIT;
