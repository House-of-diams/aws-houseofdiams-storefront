-- F7 staging rollback. Run only if the forward migration was applied.
BEGIN;

DO $f7_jpy_rollback$
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
  ) THEN
    RAISE EXCEPTION 'Payment function owner or security contract differs from audit';
  END IF;

  definition := pg_get_functiondef(function_oid);
  IF (length(definition) - length(replace(definition, new_line, ''))) / length(new_line) <> 1
     OR position(old_line IN definition) <> 0 THEN
    RAISE EXCEPTION 'Payment function is not in the expected post-migration state';
  END IF;
  EXECUTE replace(definition, new_line, old_line);
END
$f7_jpy_rollback$;

COMMIT;
