create or replace function public.create_pending_order_atomic(
  p_user_id uuid,
  p_order jsonb,
  p_items jsonb,
  p_love_letter jsonb default null
)
returns table (id uuid, order_number text, customer_email text, customer_first_name text, customer_last_name text, total_amount numeric, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_item jsonb;
begin
  if p_user_id is null then raise exception 'Missing order user.' using errcode = '22023'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then
    raise exception 'At least one order item is required.' using errcode = '22023';
  end if;

  insert into orders (
    user_id, customer_email, customer_first_name, customer_last_name, customer_phone,
    shipping_country, shipping_state, shipping_city, shipping_postal_code, shipping_address_line_1, shipping_address_line_2,
    subtotal_amount, gst_amount, shipping_amount, total_amount, love_letter_included, love_letter_type,
    status, payment_status, payment_gateway, payment_currency, payment_amount, razorpay_order_id,
    gateway_order_status, gateway_payment_status, gateway_payload, notes
  ) values (
    p_user_id, nullif(p_order->>'customer_email', ''), coalesce(nullif(p_order->>'customer_first_name', ''), 'Customer'),
    nullif(p_order->>'customer_last_name', ''), nullif(p_order->>'customer_phone', ''), nullif(p_order->>'shipping_country', ''),
    nullif(p_order->>'shipping_state', ''), nullif(p_order->>'shipping_city', ''), nullif(p_order->>'shipping_postal_code', ''),
    nullif(p_order->>'shipping_address_line_1', ''), nullif(p_order->>'shipping_address_line_2', ''),
    (p_order->>'subtotal_amount')::numeric, (p_order->>'gst_amount')::numeric, (p_order->>'shipping_amount')::numeric,
    (p_order->>'total_amount')::numeric, coalesce((p_order->>'love_letter_included')::boolean, false),
    coalesce(nullif(p_order->>'love_letter_type', ''), 'no_letter'), 'pending', 'pending', 'razorpay',
    nullif(p_order->>'payment_currency', ''), (p_order->>'payment_amount')::numeric, nullif(p_order->>'razorpay_order_id', ''),
    'created', 'pending', coalesce(p_order->'gateway_payload', '{}'::jsonb), nullif(p_order->>'notes', '')
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'item_type', 'regular') = 'free_gift' and (
      coalesce((v_item->>'quantity')::integer, 0) <> 1 or coalesce((v_item->>'unit_price')::numeric, -1) <> 0
      or coalesce((v_item->>'line_total')::numeric, -1) <> 0 or nullif(v_item->>'promotion_coupon_id', '') is null
    ) then raise exception 'Invalid free-gift order line.' using errcode = '22023'; end if;

    insert into order_items (
      order_id, product_id, product_name, product_slug, sku, quantity, unit_price, line_total,
      selected_metal, selected_purity, selected_size_or_fit, selected_gemstone, selected_carat,
      gst_slab_id, gst_percentage, gst_amount, image_url, selected_custom_dropdowns,
      item_type, promotion_coupon_id, original_unit_price, promotion_metadata
    ) values (
      v_order.id, nullif(v_item->>'product_id', '')::uuid, v_item->>'product_name', v_item->>'product_slug', nullif(v_item->>'sku', ''),
      (v_item->>'quantity')::integer, (v_item->>'unit_price')::numeric, (v_item->>'line_total')::numeric,
      nullif(v_item->>'selected_metal', ''), nullif(v_item->>'selected_purity', ''), nullif(v_item->>'selected_size_or_fit', ''),
      nullif(v_item->>'selected_gemstone', ''), nullif(v_item->>'selected_carat', ''), nullif(v_item->>'gst_slab_id', '')::uuid,
      (v_item->>'gst_percentage')::numeric, (v_item->>'gst_amount')::numeric, nullif(v_item->>'image_url', ''),
      coalesce(v_item->'selected_custom_dropdowns', '[]'::jsonb), coalesce(nullif(v_item->>'item_type', ''), 'regular'),
      nullif(v_item->>'promotion_coupon_id', '')::bigint, nullif(v_item->>'original_unit_price', '')::numeric,
      coalesce(v_item->'promotion_metadata', '{}'::jsonb)
    );
  end loop;

  if p_love_letter is not null and p_love_letter <> 'null'::jsonb then
    insert into order_love_letters (
      order_id, wants_letter, letter_type, recipient_name, sender_name, occasion_key, about_her_text,
      custom_letter_text, final_letter_text, final_letter_html, print_status
    ) values (
      v_order.id, coalesce((p_love_letter->>'wants_letter')::boolean, false), coalesce(nullif(p_love_letter->>'letter_type', ''), 'no_letter'),
      nullif(p_love_letter->>'recipient_name', ''), nullif(p_love_letter->>'sender_name', ''), nullif(p_love_letter->>'occasion_key', ''),
      nullif(p_love_letter->>'about_her_text', ''), nullif(p_love_letter->>'custom_letter_text', ''), nullif(p_love_letter->>'final_letter_text', ''),
      nullif(p_love_letter->>'final_letter_html', ''), coalesce(nullif(p_love_letter->>'print_status', ''), 'skipped')
    );
  end if;

  return query select v_order.id, v_order.order_number::text, v_order.customer_email::text, v_order.customer_first_name::text,
    v_order.customer_last_name::text, v_order.total_amount, v_order.created_at;
end;
$$;

revoke all on function public.create_pending_order_atomic(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_pending_order_atomic(uuid, jsonb, jsonb, jsonb) to service_role;

comment on function public.create_pending_order_atomic(uuid, jsonb, jsonb, jsonb) is
  'Creates a pending order, regular items, validated free-gift items, and optional love letter in one transaction.';

create or replace function public.enrich_coupon_redemption_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon record;
  v_order record;
  v_gift record;
begin
  select reward_type, minimum_order_amount, gift_product_id, gift_variant_data
    into v_coupon from coupons where id = new.coupon_id;
  select subtotal_amount into v_order from orders where id = new.order_id;
  new.reward_type := coalesce(v_coupon.reward_type, 'percentage');
  new.qualified_subtotal := coalesce(v_order.subtotal_amount, 0);
  new.reward_metadata := jsonb_build_object(
    'minimum_order_amount', coalesce(v_coupon.minimum_order_amount, 0),
    'gift_variant_data', coalesce(v_coupon.gift_variant_data, '{}'::jsonb)
  );
  if new.reward_type = 'free_gift' then
    select id, product_id into v_gift
      from order_items
     where order_id = new.order_id and item_type = 'free_gift' and promotion_coupon_id = new.coupon_id
     limit 1;
    if not found then raise exception 'Paid gift coupon order is missing its gift line.' using errcode = '23514'; end if;
    new.gift_product_id := v_gift.product_id;
    new.gift_order_item_id := v_gift.id;
    new.discount_amount := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists coupon_redemptions_enrich_reward on public.coupon_redemptions;
create trigger coupon_redemptions_enrich_reward
before insert on public.coupon_redemptions
for each row execute function public.enrich_coupon_redemption_reward();

revoke all on function public.enrich_coupon_redemption_reward() from public, anon, authenticated;
