-- Rollback for HOD-012: restores the previous finalize function. The index is left in place (harmless).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guard$
declare v_src text;
begin
  if current_user <> 'hod_migration' then raise exception 'Run as hod_migration'; end if;
  select p.prosrc into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'finalize_paid_order_with_coupon_secure';
  if position('HOD-012' in coalesce(v_src, '')) = 0 then raise exception 'Patched function is not installed; nothing to roll back'; end if;
end $guard$;

CREATE OR REPLACE FUNCTION public.finalize_paid_order_with_coupon_secure(p_order_id uuid DEFAULT NULL::uuid, p_razorpay_order_id text DEFAULT NULL::text, p_payment_id text DEFAULT NULL::text, p_signature text DEFAULT NULL::text, p_payment_method text DEFAULT NULL::text, p_payment_contact text DEFAULT NULL::text, p_payment_email text DEFAULT NULL::text, p_gateway_payment_status text DEFAULT 'captured'::text, p_payment_amount_subunits bigint DEFAULT NULL::bigint, p_payment_currency text DEFAULT NULL::text, p_raw_event jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(ok boolean, already_paid boolean, order_id uuid, order_number text, total_amount numeric, error_code text, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_guard record;
  v_result record;
  v_order record;
  v_coupon jsonb;
  v_coupon_row record;
begin
  select * into v_guard
    from public.guard_paid_order_inventory_reservation(p_order_id);
  if not coalesce(v_guard.ok, false) then
    return query select false, false, p_order_id, null::text, null::numeric, v_guard.error_code, v_guard.message;
    return;
  end if;

  select * into v_result
    from public.finalize_paid_order_with_inventory_secure(
      p_order_id, p_razorpay_order_id, p_payment_id, p_signature,
      p_payment_method, p_payment_contact, p_payment_email,
      p_gateway_payment_status, p_payment_amount_subunits,
      p_payment_currency, p_raw_event
    );
  if not coalesce(v_result.ok, false) then
    return query select v_result.ok, v_result.already_paid, v_result.order_id,
      v_result.order_number, v_result.total_amount, v_result.error_code, v_result.message;
    return;
  end if;

  update public.inventory_reservations
     set status = 'consumed', consumed_at = now(), updated_at = now()
   where inventory_reservations.order_id = v_result.order_id
     and inventory_reservations.status = 'active';

  select * into v_order from public.orders where id = v_result.order_id for update;
  v_coupon := v_order.gateway_payload->'checkout'->'coupon';
  if v_coupon is not null and nullif(v_coupon->>'id', '') is not null and nullif(v_coupon->>'code', '') is not null then
    select id, code, usage_count into v_coupon_row
      from public.coupons
     where id = (v_coupon->>'id')::bigint and upper(code) = upper(v_coupon->>'code')
     for update;
    if found then
      perform 1
        from public.coupon_redemptions as cr
       where cr.order_id = v_order.id
       limit 1;
      if not found then
        insert into public.coupon_redemptions (
          coupon_id, coupon_code, user_id, customer_identity_id, order_id, order_number, discount_amount
        ) values (
          v_coupon_row.id, v_coupon_row.code, v_order.user_id, v_order.customer_identity_id, v_order.id,
          v_order.order_number, coalesce((v_coupon->>'discountAmount')::numeric, 0)
        );
        update public.coupons set usage_count = coalesce(usage_count, 0) + 1 where id = v_coupon_row.id;
      end if;
    end if;
  end if;

  return query select v_result.ok, v_result.already_paid, v_result.order_id,
    v_result.order_number, v_result.total_amount, v_result.error_code, v_result.message;
end;
$function$;

commit;
