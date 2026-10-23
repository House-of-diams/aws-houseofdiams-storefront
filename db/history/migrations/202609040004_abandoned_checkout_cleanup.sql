create or replace function public.cancel_pending_checkout(p_order_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  select id, user_id, payment_status
    into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found or v_order.user_id <> p_user_id or v_order.payment_status <> 'pending' then
    return false;
  end if;

  update public.inventory_reservations
     set status = 'released', released_at = now(), updated_at = now()
   where order_id = p_order_id and status = 'active';

  update public.orders
     set gateway_order_status = 'checkout_dismissed'
   where id = p_order_id;

  return true;
end;
$$;

revoke all on function public.cancel_pending_checkout(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_pending_checkout(uuid, uuid)
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

  update public.orders order_row
     set gateway_order_status = 'expired'
   where order_row.payment_status = 'pending'
     and order_row.gateway_order_status in ('created', 'pending', 'checkout_dismissed')
     and exists (
       select 1 from public.inventory_reservations reservation
        where reservation.order_id = order_row.id and reservation.status = 'expired'
     )
     and not exists (
       select 1 from public.inventory_reservations reservation
        where reservation.order_id = order_row.id
          and reservation.status = 'active' and reservation.expires_at > now()
     );

  return v_count;
end;
$$;

revoke all on function public.expire_inventory_reservations(integer)
  from public, anon, authenticated;
grant execute on function public.expire_inventory_reservations(integer)
  to service_role;

