create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'active'
    check (status in ('active', 'consumed', 'released', 'expired')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_reservations_order_product_unique unique (order_id, product_id)
);

create index if not exists inventory_reservations_active_product_idx
  on public.inventory_reservations (product_id, expires_at)
  where status = 'active';

create index if not exists inventory_reservations_active_expiry_idx
  on public.inventory_reservations (expires_at)
  where status = 'active';

alter table public.inventory_reservations enable row level security;
revoke all on table public.inventory_reservations from public, anon, authenticated;
grant select, insert, update on table public.inventory_reservations to service_role;

create or replace function public.reserve_pending_order_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_product record;
  v_existing_quantity integer := 0;
  v_other_reserved integer := 0;
  v_requested integer;
begin
  select id, status, payment_status, payment_gateway, created_at
    into v_order
    from public.orders
   where id = new.order_id;

  if not found
     or v_order.payment_gateway <> 'razorpay'
     or v_order.payment_status <> 'pending' then
    return new;
  end if;

  if new.product_id is null or coalesce(new.quantity, 0) <= 0 then
    raise exception 'A reservable order item must reference inventory and have a positive quantity.'
      using errcode = '23514';
  end if;

  select id, name, stock_quantity
    into v_product
    from public.products
   where id = new.product_id
   for update;

  if not found then
    raise exception 'Cannot reserve a missing product.' using errcode = '23503';
  end if;

  update public.inventory_reservations
     set status = 'expired', updated_at = now()
   where product_id = new.product_id
     and status = 'active'
     and expires_at <= now();

  select coalesce(quantity, 0)
    into v_existing_quantity
    from public.inventory_reservations
   where order_id = new.order_id
     and product_id = new.product_id;

  select coalesce(sum(quantity), 0)::integer
    into v_other_reserved
    from public.inventory_reservations
   where product_id = new.product_id
     and order_id <> new.order_id
     and status = 'active'
     and expires_at > now();

  v_requested := coalesce(v_existing_quantity, 0) + new.quantity;
  if coalesce(v_product.stock_quantity, 0) - v_other_reserved < v_requested then
    raise exception 'Insufficient available stock for %.', coalesce(v_product.name, 'product')
      using errcode = 'P0001';
  end if;

  insert into public.inventory_reservations (
    order_id, product_id, quantity, status, expires_at
  ) values (
    new.order_id,
    new.product_id,
    new.quantity,
    'active',
    greatest(now(), v_order.created_at) + interval '15 minutes'
  )
  on conflict (order_id, product_id) do update
    set quantity = excluded.quantity + public.inventory_reservations.quantity,
        status = 'active',
        expires_at = excluded.expires_at,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists order_items_reserve_inventory on public.order_items;
create trigger order_items_reserve_inventory
after insert on public.order_items
for each row execute function public.reserve_pending_order_item();

revoke all on function public.reserve_pending_order_item() from public, anon, authenticated;

create or replace function public.guard_paid_order_inventory_reservation(p_order_id uuid)
returns table (ok boolean, error_code text, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_product record;
  v_own_reserved integer;
  v_other_reserved integer;
begin
  if exists (
    select 1 from public.orders where id = p_order_id and payment_status = 'paid'
  ) then
    return query select true, null::text, 'Order inventory was already finalized.';
    return;
  end if;

  perform id
    from public.products
   where id in (
     select product_id from public.order_items where order_id = p_order_id
   )
   order by id
   for update;

  update public.inventory_reservations
     set status = 'expired', updated_at = now()
   where status = 'active'
     and expires_at <= now()
     and product_id in (
       select product_id from public.order_items where order_id = p_order_id
     );

  for v_item in
    select product_id, sum(quantity)::integer as quantity
      from public.order_items
     where order_id = p_order_id
     group by product_id
     order by product_id
  loop
    if v_item.product_id is null then
      return query select false, 'missing_product_reference', 'One or more order items are not linked to inventory.';
      return;
    end if;

    select id, name, stock_quantity
      into v_product
      from public.products
     where id = v_item.product_id;
    if not found then
      return query select false, 'product_not_found', 'One or more order products no longer exist.';
      return;
    end if;

    select coalesce(sum(quantity), 0)::integer
      into v_own_reserved
      from public.inventory_reservations
     where order_id = p_order_id
       and product_id = v_item.product_id
       and status = 'active'
       and expires_at > now();

    if v_own_reserved < v_item.quantity then
      select coalesce(sum(quantity), 0)::integer
        into v_other_reserved
        from public.inventory_reservations
       where order_id <> p_order_id
         and product_id = v_item.product_id
         and status = 'active'
         and expires_at > now();

      if coalesce(v_product.stock_quantity, 0) - v_other_reserved < v_item.quantity then
        return query select false, 'insufficient_stock', format('Insufficient stock for %s.', coalesce(v_product.name, 'a product'));
        return;
      end if;
    end if;
  end loop;

  return query select true, null::text, 'Inventory reservation is valid.';
end;
$$;

revoke all on function public.guard_paid_order_inventory_reservation(uuid)
  from public, anon, authenticated;

create or replace function public.release_order_inventory_reservation(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.inventory_reservations
     set status = 'released', released_at = now(), updated_at = now()
   where order_id = p_order_id
     and status = 'active';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.release_order_inventory_reservation(uuid)
  from public, anon, authenticated;
grant execute on function public.release_order_inventory_reservation(uuid)
  to service_role;

create or replace function public.expire_inventory_reservations(p_limit integer default 500)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    select id
      from public.inventory_reservations
     where status = 'active' and expires_at <= now()
     order by expires_at
     limit greatest(1, least(coalesce(p_limit, 500), 5000))
     for update skip locked
  )
  update public.inventory_reservations reservation
     set status = 'expired', updated_at = now()
    from expired
   where reservation.id = expired.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_inventory_reservations(integer)
  from public, anon, authenticated;
grant execute on function public.expire_inventory_reservations(integer)
  to service_role;

revoke all on function public.finalize_paid_order_with_inventory_secure(uuid, text, text, text, text, text, text, text, bigint, text, jsonb)
  from public, anon, authenticated, service_role;

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
returns table (ok boolean, already_paid boolean, order_id uuid, order_number text, total_amount numeric, error_code text, message text)
language plpgsql
security definer
set search_path = public
as $$
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
   where order_id = v_result.order_id and status = 'active';

  select * into v_order from public.orders where id = v_result.order_id for update;
  v_coupon := v_order.gateway_payload->'checkout'->'coupon';
  if v_coupon is not null and nullif(v_coupon->>'id', '') is not null and nullif(v_coupon->>'code', '') is not null then
    select id, code, usage_count into v_coupon_row
      from public.coupons
     where id = (v_coupon->>'id')::bigint and upper(code) = upper(v_coupon->>'code')
     for update;
    if found then
      perform 1 from public.coupon_redemptions where order_id = v_order.id limit 1;
      if not found then
        insert into public.coupon_redemptions (
          coupon_id, coupon_code, user_id, order_id, order_number, discount_amount
        ) values (
          v_coupon_row.id, v_coupon_row.code, v_order.user_id, v_order.id,
          v_order.order_number, coalesce((v_coupon->>'discountAmount')::numeric, 0)
        );
        update public.coupons set usage_count = coalesce(usage_count, 0) + 1 where id = v_coupon_row.id;
      end if;
    end if;
  end if;

  return query select v_result.ok, v_result.already_paid, v_result.order_id,
    v_result.order_number, v_result.total_amount, v_result.error_code, v_result.message;
end;
$$;

revoke all on function public.finalize_paid_order_with_coupon_secure(uuid, text, text, text, text, text, text, text, bigint, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.finalize_paid_order_with_coupon_secure(uuid, text, text, text, text, text, text, text, bigint, text, jsonb)
  to service_role;
