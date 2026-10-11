-- Read-only verification. Run as hod_app after the reviewed forward migration.
BEGIN READ ONLY;

SELECT current_user AS database_role,
       p.prosecdef AS security_definer,
       pg_get_userbyid(p.proowner) AS function_owner,
       has_function_privilege(current_user, p.oid, 'EXECUTE') AS can_execute,
       position('when ''jpy'' then round(coalesce(v_order.payment_amount, 0))::bigint'
         IN lower(pg_get_functiondef(p.oid))) > 0 AS jpy_uses_whole_yen,
       position('else round(coalesce(v_order.payment_amount, 0) * 100)::bigint'
         IN lower(pg_get_functiondef(p.oid))) > 0 AS other_currencies_use_hundredths
FROM pg_proc p
WHERE p.oid = to_regprocedure('public.finalize_paid_order_with_inventory_secure(uuid,text,text,text,text,text,text,text,bigint,text,jsonb)');

ROLLBACK;
