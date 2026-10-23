create or replace function public.finalize_paid_order_with_coupon_secure(
  p_order_id uuid default null,
  p_razorpay_order_id text default null,
  p_payment_id text default null,
  p_signature text default null,
  p_payment_method text default null,
  p_payment_contact text default null,
  p_payment_email text default null,
  p_gateway_payment_status text default 'captured',
  p_payment_amount_subunits bigint default null,
  p_payment_currency text default null,
  p_raw_event jsonb default null
)
returns table (
  ok boolean,
  already_paid boolean,
  order_id uuid,
  order_number text,
  total_amount numeric,
  error_code text,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result record;
  v_order record;
  v_coupon jsonb;
  v_coupon_row record;
begin
  select *
    into v_result
    from public.finalize_paid_order_with_inventory_secure(
      p_order_id,
      p_razorpay_order_id,
      p_payment_id,
      p_signature,
      p_payment_method,
      p_payment_contact,
      p_payment_email,
      p_gateway_payment_status,
      p_payment_amount_subunits,
      p_payment_currency,
      p_raw_event
    );

  if not coalesce(v_result.ok, false) then
    return query select
      v_result.ok,
      v_result.already_paid,
      v_result.order_id,
      v_result.order_number,
      v_result.total_amount,
      v_result.error_code,
      v_result.message;
    return;
  end if;

  select *
    into v_order
    from orders
   where id = v_result.order_id
   for update;

  v_coupon := v_order.gateway_payload->'checkout'->'coupon';

  if v_coupon is not null
     and nullif(v_coupon->>'id', '') is not null
     and nullif(v_coupon->>'code', '') is not null then
    select id, code, usage_count
      into v_coupon_row
      from coupons
     where id = (v_coupon->>'id')::bigint
       and upper(code) = upper(v_coupon->>'code')
     for update;

    if found then
      perform 1
        from coupon_redemptions
       where order_id = v_order.id
       limit 1;

      if not found then
        insert into coupon_redemptions (
          coupon_id,
          coupon_code,
          user_id,
          order_id,
          order_number,
          discount_amount
        )
        values (
          v_coupon_row.id,
          v_coupon_row.code,
          v_order.user_id,
          v_order.id,
          v_order.order_number,
          coalesce((v_coupon->>'discountAmount')::numeric, 0)
        );

        update coupons
           set usage_count = coalesce(usage_count, 0) + 1
         where id = v_coupon_row.id;
      end if;
    end if;
  end if;

  return query select
    v_result.ok,
    v_result.already_paid,
    v_result.order_id,
    v_result.order_number,
    v_result.total_amount,
    v_result.error_code,
    v_result.message;
end;
$$;

revoke all on function public.finalize_paid_order_with_coupon_secure(uuid, text, text, text, text, text, text, text, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_paid_order_with_coupon_secure(uuid, text, text, text, text, text, text, text, bigint, text, jsonb) to service_role;

comment on function public.finalize_paid_order_with_coupon_secure(uuid, text, text, text, text, text, text, text, bigint, text, jsonb) is
  'Atomically finalizes a verified payment, allocates stock, and records coupon redemption exactly once.';
