begin;

-- Stable checkout write boundary. Returning jsonb avoids PL/pgSQL OUT variables
-- such as `id`, which can collide with table columns in RETURNS TABLE functions.
-- Keep this function self-contained so later schema wrappers cannot silently
-- reintroduce ambiguous-column failures into checkout.
create or replace function public.create_pending_order_v2(
  p_user_id uuid,
  p_order jsonb,
  p_items jsonb,
  p_love_letter jsonb default null,
  p_customer_birth_date date default null,
  p_customer_anniversary_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_order public.orders%rowtype;
  v_item jsonb;
  v_guest_token_hash text := lower(nullif(trim(p_order->>'guest_token_hash'), ''));
begin
  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'Missing order payload.' using errcode = '22023';
  end if;

  if (p_user_id is null and v_guest_token_hash is null)
     or (p_user_id is not null and v_guest_token_hash is not null) then
    raise exception 'Exactly one order owner is required.' using errcode = '22023';
  end if;

  if v_guest_token_hash is not null
     and v_guest_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid guest checkout token hash.' using errcode = '22023';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 then
    raise exception 'At least one order item is required.' using errcode = '22023';
  end if;

  if p_customer_birth_date is not null and p_customer_birth_date > current_date then
    raise exception 'Birth date cannot be in the future.' using errcode = '22023';
  end if;

  insert into public.orders as target_order (
    user_id,
    guest_token_hash,
    customer_email,
    customer_first_name,
    customer_last_name,
    customer_phone,
    customer_birth_date,
    customer_anniversary_date,
    shipping_country,
    shipping_state,
    shipping_district,
    shipping_city,
    shipping_postal_code,
    shipping_address_line_1,
    shipping_address_line_2,
    subtotal_amount,
    gst_amount,
    shipping_amount,
    total_amount,
    love_letter_included,
    love_letter_type,
    status,
    payment_status,
    payment_gateway,
    payment_currency,
    payment_amount,
    razorpay_order_id,
    gateway_order_status,
    gateway_payment_status,
    gateway_payload,
    notes
  ) values (
    p_user_id,
    v_guest_token_hash,
    nullif(p_order->>'customer_email', ''),
    coalesce(nullif(p_order->>'customer_first_name', ''), 'Customer'),
    nullif(p_order->>'customer_last_name', ''),
    nullif(p_order->>'customer_phone', ''),
    p_customer_birth_date,
    p_customer_anniversary_date,
    nullif(p_order->>'shipping_country', ''),
    nullif(p_order->>'shipping_state', ''),
    nullif(p_order->>'shipping_district', ''),
    nullif(p_order->>'shipping_city', ''),
    nullif(p_order->>'shipping_postal_code', ''),
    nullif(p_order->>'shipping_address_line_1', ''),
    nullif(p_order->>'shipping_address_line_2', ''),
    (p_order->>'subtotal_amount')::numeric,
    (p_order->>'gst_amount')::numeric,
    (p_order->>'shipping_amount')::numeric,
    (p_order->>'total_amount')::numeric,
    coalesce((p_order->>'love_letter_included')::boolean, false),
    coalesce(nullif(p_order->>'love_letter_type', ''), 'no_letter'),
    'pending',
    'pending',
    'razorpay',
    nullif(p_order->>'payment_currency', ''),
    (p_order->>'payment_amount')::numeric,
    nullif(p_order->>'razorpay_order_id', ''),
    'created',
    'pending',
    coalesce(p_order->'gateway_payload', '{}'::jsonb),
    nullif(p_order->>'notes', '')
  )
  returning target_order.* into v_created_order;

  for v_item in
    select item_element.value
    from jsonb_array_elements(p_items) as item_element(value)
  loop
    if coalesce(v_item->>'item_type', 'regular') = 'free_gift'
       and (
         coalesce((v_item->>'quantity')::integer, 0) <> 1
         or coalesce((v_item->>'unit_price')::numeric, -1) <> 0
         or coalesce((v_item->>'line_total')::numeric, -1) <> 0
         or nullif(v_item->>'promotion_coupon_id', '') is null
       ) then
      raise exception 'Invalid free-gift order line.' using errcode = '22023';
    end if;

    insert into public.order_items as target_item (
      order_id,
      product_id,
      product_name,
      product_slug,
      sku,
      quantity,
      unit_price,
      line_total,
      selected_metal,
      selected_purity,
      selected_size_or_fit,
      selected_gemstone,
      selected_carat,
      gst_slab_id,
      gst_percentage,
      gst_amount,
      image_url,
      selected_custom_dropdowns,
      item_type,
      promotion_coupon_id,
      original_unit_price,
      promotion_metadata
    ) values (
      v_created_order.id,
      nullif(v_item->>'product_id', '')::uuid,
      v_item->>'product_name',
      v_item->>'product_slug',
      nullif(v_item->>'sku', ''),
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'line_total')::numeric,
      nullif(v_item->>'selected_metal', ''),
      nullif(v_item->>'selected_purity', ''),
      nullif(v_item->>'selected_size_or_fit', ''),
      nullif(v_item->>'selected_gemstone', ''),
      nullif(v_item->>'selected_carat', ''),
      nullif(v_item->>'gst_slab_id', '')::uuid,
      (v_item->>'gst_percentage')::numeric,
      (v_item->>'gst_amount')::numeric,
      nullif(v_item->>'image_url', ''),
      coalesce(v_item->'selected_custom_dropdowns', '[]'::jsonb),
      coalesce(nullif(v_item->>'item_type', ''), 'regular'),
      nullif(v_item->>'promotion_coupon_id', '')::bigint,
      nullif(v_item->>'original_unit_price', '')::numeric,
      coalesce(v_item->'promotion_metadata', '{}'::jsonb)
    );
  end loop;

  if p_love_letter is not null and p_love_letter <> 'null'::jsonb then
    insert into public.order_love_letters as target_letter (
      order_id,
      wants_letter,
      letter_type,
      recipient_name,
      sender_name,
      occasion_key,
      about_her_text,
      custom_letter_text,
      final_letter_text,
      final_letter_html,
      print_status
    ) values (
      v_created_order.id,
      coalesce((p_love_letter->>'wants_letter')::boolean, false),
      coalesce(nullif(p_love_letter->>'letter_type', ''), 'no_letter'),
      nullif(p_love_letter->>'recipient_name', ''),
      nullif(p_love_letter->>'sender_name', ''),
      nullif(p_love_letter->>'occasion_key', ''),
      nullif(p_love_letter->>'about_her_text', ''),
      nullif(p_love_letter->>'custom_letter_text', ''),
      nullif(p_love_letter->>'final_letter_text', ''),
      nullif(p_love_letter->>'final_letter_html', ''),
      coalesce(nullif(p_love_letter->>'print_status', ''), 'skipped')
    );
  end if;

  return jsonb_build_object(
    'id', v_created_order.id,
    'order_number', v_created_order.order_number,
    'customer_email', v_created_order.customer_email,
    'customer_first_name', v_created_order.customer_first_name,
    'customer_last_name', v_created_order.customer_last_name,
    'total_amount', v_created_order.total_amount,
    'created_at', v_created_order.created_at
  );
end;
$$;

revoke all on function public.create_pending_order_v2(uuid, jsonb, jsonb, jsonb, date, date)
  from public, anon, authenticated;
grant execute on function public.create_pending_order_v2(uuid, jsonb, jsonb, jsonb, date, date)
  to service_role;

comment on function public.create_pending_order_v2(uuid, jsonb, jsonb, jsonb, date, date) is
  'Versioned, self-contained pending-order transaction with an unambiguous JSON response contract.';

commit;
