-- F7 staging proposal. Review and run as the function owner (hod_migration).
-- Changes only the JPY amount-unit calculation in the existing atomic function.
-- Does not enable checkout or resolve F7 inventory/customer-ownership blockers.
BEGIN;

DO $f7_jpy$
DECLARE
  function_oid oid;
  old_line constant text := 'v_expected_amount_subunits := round(coalesce(v_order.payment_amount, 0) * 100)::bigint;';
  new_line constant text := E'v_expected_amount_subunits := case upper(v_order.payment_currency)\n    when ''JPY'' then round(coalesce(v_order.payment_amount, 0))::bigint\n    else round(coalesce(v_order.payment_amount, 0) * 100)::bigint\n  end;';
  definition text;
BEGIN
  function_oid := to_regprocedure('public.finalize_paid_order_with_inventory_secure(uuid,text,text,text,text,text,text,text,bigint,text,jsonb)');
  IF function_oid IS NULL THEN
    RAISE EXCEPTION 'Expected F7 payment function signature is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = function_oid AND prosecdef
      AND pg_get_userbyid(proowner) = current_user
      AND proconfig @> ARRAY['search_path=public']::text[]
      AND NOT has_function_privilege('hod_app', oid, 'EXECUTE')
      AND NOT has_function_privilege('anon', oid, 'EXECUTE')
      AND NOT has_function_privilege('authenticated', oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'Payment function owner or security contract differs from audit';
  END IF;

  definition := pg_get_functiondef(function_oid);
  IF (length(definition) - length(replace(definition, old_line, ''))) / length(old_line) <> 1
     OR position(new_line IN definition) <> 0 THEN
    RAISE EXCEPTION 'Payment function amount-unit expression differs from audit';
  END IF;

  -- Recreate from the exact installed definition, replacing only this expression.
  -- CREATE OR REPLACE retains the existing function identity, owner, and grants.
  EXECUTE replace(definition, old_line, new_line);
END
$f7_jpy$;

COMMIT;
