create or replace function public.finalize_paid_order_with_inventory(
  p_order_id uuid default null,
  p_razorpay_order_id text default null,
  p_payment_id text default null,
  p_signature text default null,
  p_payment_method text default null,
  p_payment_contact text default null,
  p_payment_email text default null,
  p_gateway_payment_status text default 'captured',
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
  v_order record;
  v_item record;
  v_product record;
  v_paid_at timestamptz := now();
  v_gateway_payload jsonb;
begin
  if p_order_id is null and nullif(trim(coalesce(p_razorpay_order_id, '')), '') is null then
    return query select false, false, null::uuid, null::text, null::numeric, 'missing_order_reference', 'Missing order reference.';
    return;
  end if;

  select *
    into v_order
    from orders
   where (p_order_id is not null and id = p_order_id)
      or (p_order_id is null and razorpay_order_id = p_razorpay_order_id)
   limit 1
   for update;

  if not found then
    return query select false, false, null::uuid, null::text, null::numeric, 'order_not_found', 'Order not found.';
    return;
  end if;

  if v_order.payment_status = 'paid' then
    return query select true, true, v_order.id, v_order.order_number::text, v_order.total_amount, null::text, 'Order already paid.';
    return;
  end if;

  for v_item in
    select product_id, sum(quantity)::integer as quantity
      from order_items
     where order_id = v_order.id
     group by product_id
  loop
    if v_item.product_id is null then
      return query select false, false, v_order.id, v_order.order_number::text, v_order.total_amount, 'missing_product_reference', 'One or more order items are not linked to inventory.';
      return;
    end if;

    select id, name, stock_quantity
      into v_product
      from products
     where id = v_item.product_id
     for update;

    if not found then
      return query select false, false, v_order.id, v_order.order_number::text, v_order.total_amount, 'product_not_found', 'One or more order products no longer exist.';
      return;
    end if;

    if coalesce(v_product.stock_quantity, 0) < v_item.quantity then
      return query select false, false, v_order.id, v_order.order_number::text, v_order.total_amount, 'insufficient_stock', format('Insufficient stock for %s.', coalesce(v_product.name, 'a product'));
      return;
    end if;
  end loop;

  for v_item in
    select product_id, sum(quantity)::integer as quantity
      from order_items
     where order_id = v_order.id
     group by product_id
  loop
    select id, stock_quantity
      into v_product
      from products
     where id = v_item.product_id
     for update;

    update products
       set stock_quantity = coalesce(stock_quantity, 0) - v_item.quantity
     where id = v_item.product_id;

    begin
      insert into inventory_adjustments (
        product_id,
        adjustment_type,
        quantity_change,
        previous_stock,
        new_stock,
        notes
      )
      values (
        v_item.product_id,
        'order_placed',
        -v_item.quantity,
        coalesce(v_product.stock_quantity, 0),
        coalesce(v_product.stock_quantity, 0) - v_item.quantity,
        'Stock decremented after verified paid order ' || v_order.order_number::text || '.'
      );
    exception when others then
      null;
    end;
  end loop;

  v_gateway_payload :=
    coalesce(v_order.gateway_payload, '{}'::jsonb)
    || jsonb_build_object(
      'payment',
      coalesce(v_order.gateway_payload->'payment', '{}'::jsonb)
        || jsonb_build_object(
          'razorpayOrderId', coalesce(p_razorpay_order_id, v_order.razorpay_order_id),
          'razorpayPaymentId', p_payment_id,
          'razorpaySignature', p_signature,
          'paymentMethod', p_payment_method,
          'paymentEmail', p_payment_email,
          'paymentContact', p_payment_contact,
          'eventType', coalesce(p_gateway_payment_status, 'captured')
        ),
      'rawEvent',
      coalesce(p_raw_event, v_order.gateway_payload->'rawEvent')
    );

  update orders
     set payment_status = 'paid',
         gateway_payment_status = coalesce(p_gateway_payment_status, 'captured'),
         gateway_order_status = 'paid',
         razorpay_order_id = coalesce(p_razorpay_order_id, razorpay_order_id),
         razorpay_payment_id = p_payment_id,
         razorpay_signature = p_signature,
         razorpay_payment_method = p_payment_method,
         razorpay_payment_contact = p_payment_contact,
         razorpay_payment_email = p_payment_email,
         payment_verified_at = v_paid_at,
         payment_captured_at = v_paid_at,
         gateway_payload = v_gateway_payload
   where id = v_order.id
   returning * into v_order;

  return query select true, false, v_order.id, v_order.order_number::text, v_order.total_amount, null::text, 'Order paid and stock allocated.';
end;
$$;
