begin;

-- Guest ownership is represented by a SHA-256 token hash. Raw guest tokens must
-- never be stored in the database.
alter table public.orders
  add column if not exists guest_token_hash text,
  add column if not exists shipping_district text;

alter table public.orders
  alter column user_id drop not null;

alter table public.orders
  drop constraint if exists orders_checkout_owner_check;

alter table public.orders
  add constraint orders_checkout_owner_check
  check (
    (user_id is not null and guest_token_hash is null)
    or
    (user_id is null and guest_token_hash ~ '^[0-9a-f]{64}$')
  ) not valid;

alter table public.orders
  validate constraint orders_checkout_owner_check;

create index if not exists orders_guest_token_hash_idx
  on public.orders (guest_token_hash)
  where guest_token_hash is not null;

-- Preserve the existing signed-in idempotency path and add an equivalent guest
-- path. Exactly one owner type must be present on each attempt.
alter table public.checkout_attempts
  add column if not exists guest_token_hash text;

alter table public.checkout_attempts
  alter column user_id drop not null;

alter table public.checkout_attempts
  drop constraint if exists checkout_attempts_user_key_unique;

alter table public.checkout_attempts
  drop constraint if exists checkout_attempts_owner_check;

alter table public.checkout_attempts
  add constraint checkout_attempts_owner_check
  check (
    (user_id is not null and guest_token_hash is null)
    or
    (user_id is null and guest_token_hash ~ '^[0-9a-f]{64}$')
  ) not valid;

alter table public.checkout_attempts
  validate constraint checkout_attempts_owner_check;

create unique index if not exists checkout_attempts_user_idempotency_uidx
  on public.checkout_attempts (user_id, idempotency_key)
  where user_id is not null;

create unique index if not exists checkout_attempts_guest_idempotency_uidx
  on public.checkout_attempts (guest_token_hash, idempotency_key)
  where guest_token_hash is not null;

-- Coupon redemption remains linked to the order for guests. Existing account
-- redemptions continue to retain their user id.
alter table public.coupon_redemptions
  alter column user_id drop not null;

-- Keep the existing signature so all current signed-in callers remain compatible.
-- Guest callers pass a SHA-256 hash in p_order->>'guest_token_hash'.
create or replace function public.create_pending_order_atomic(
  p_user_id uuid,
  p_order jsonb,
  p_items jsonb,
  p_love_letter jsonb default null
)
returns table (
  id uuid,
  order_number text,
  customer_email text,
  customer_first_name text,
  customer_last_name text,
  total_amount numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
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

  insert into public.orders as order_row (
    user_id,
    guest_token_hash,
    customer_email,
    customer_first_name,
    customer_last_name,
    customer_phone,
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
  returning * into v_order;

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

    insert into public.order_items as order_item_row (
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
      v_order.id,
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
    insert into public.order_love_letters as love_letter_row (
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
      v_order.id,
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

  return query
  select
    v_order.id,
    v_order.order_number::text,
    v_order.customer_email::text,
    v_order.customer_first_name::text,
    v_order.customer_last_name::text,
    v_order.total_amount,
    v_order.created_at;
end;
$$;

revoke all on function public.create_pending_order_atomic(uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_pending_order_atomic(uuid, jsonb, jsonb, jsonb)
  to service_role;

comment on function public.create_pending_order_atomic(uuid, jsonb, jsonb, jsonb) is
  'Creates an account-owned or SHA-256 guest-owned pending order atomically, including inventory-triggered items, a validated gift, and an optional love letter.';

-- Guest cancellation is separate so the existing account cancellation RPC and
-- all current callers remain unchanged.
create or replace function public.cancel_pending_guest_checkout(
  p_order_id uuid,
  p_guest_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_normalized_guest_token_hash text := lower(nullif(trim(p_guest_token_hash), ''));
begin
  if p_order_id is null
     or v_normalized_guest_token_hash is null
     or v_normalized_guest_token_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  select
    order_row.id,
    order_row.payment_status
  into v_order
  from public.orders as order_row
  where order_row.id = p_order_id
    and order_row.user_id is null
    and order_row.guest_token_hash = v_normalized_guest_token_hash
  for update;

  if not found or v_order.payment_status <> 'pending' then
    return false;
  end if;

  update public.inventory_reservations as reservation_row
  set
    status = 'released',
    released_at = now(),
    updated_at = now()
  where reservation_row.order_id = p_order_id
    and reservation_row.status = 'active';

  update public.orders as order_row
  set gateway_order_status = 'checkout_dismissed'
  where order_row.id = p_order_id
    and order_row.user_id is null
    and order_row.guest_token_hash = v_normalized_guest_token_hash;

  return found;
end;
$$;

revoke all on function public.cancel_pending_guest_checkout(uuid, text)
  from public, anon, authenticated;
grant execute on function public.cancel_pending_guest_checkout(uuid, text)
  to service_role;

comment on function public.cancel_pending_guest_checkout(uuid, text) is
  'Releases an unpaid guest order only when both the order id and SHA-256 guest ownership hash match.';

commit;

-- Verification: all values should be zero except account_orders and
-- account_attempts, which may contain the current signed-in records.
select
  count(*) filter (where order_row.user_id is null and order_row.guest_token_hash is null) as ownerless_orders,
  count(*) filter (where order_row.user_id is not null and order_row.guest_token_hash is not null) as double_owned_orders,
  count(*) filter (where order_row.user_id is not null) as account_orders,
  count(*) filter (where order_row.guest_token_hash is not null) as guest_orders
from public.orders as order_row;

select
  count(*) filter (where attempt_row.user_id is null and attempt_row.guest_token_hash is null) as ownerless_attempts,
  count(*) filter (where attempt_row.user_id is not null and attempt_row.guest_token_hash is not null) as double_owned_attempts,
  count(*) filter (where attempt_row.user_id is not null) as account_attempts,
  count(*) filter (where attempt_row.guest_token_hash is not null) as guest_attempts
from public.checkout_attempts as attempt_row;
