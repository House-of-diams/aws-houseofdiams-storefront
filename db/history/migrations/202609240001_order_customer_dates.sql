begin;

-- These dates are an optional snapshot of the customer details used for this
-- order. They deliberately live on orders (not profiles) so guest checkout
-- never creates or modifies a customer profile.
alter table public.orders
  add column if not exists customer_birth_date date,
  add column if not exists customer_anniversary_date date;

create or replace function public.create_pending_order_with_customer_dates(
  p_user_id uuid,
  p_order jsonb,
  p_items jsonb,
  p_love_letter jsonb default null,
  p_customer_birth_date date default null,
  p_customer_anniversary_date date default null
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
  v_order record;
begin
  if p_customer_birth_date is not null and p_customer_birth_date > current_date then
    raise exception 'Birth date cannot be in the future.' using errcode = '22023';
  end if;

  select * into v_order
  from public.create_pending_order_atomic(p_user_id, p_order, p_items, p_love_letter);

  update public.orders
  set
    customer_birth_date = p_customer_birth_date,
    customer_anniversary_date = p_customer_anniversary_date
  where orders.id = v_order.id;

  return query
  select
    v_order.id,
    v_order.order_number,
    v_order.customer_email,
    v_order.customer_first_name,
    v_order.customer_last_name,
    v_order.total_amount,
    v_order.created_at;
end;
$$;

revoke all on function public.create_pending_order_with_customer_dates(uuid, jsonb, jsonb, jsonb, date, date) from public;
revoke all on function public.create_pending_order_with_customer_dates(uuid, jsonb, jsonb, jsonb, date, date) from anon;
revoke all on function public.create_pending_order_with_customer_dates(uuid, jsonb, jsonb, jsonb, date, date) from authenticated;
grant execute on function public.create_pending_order_with_customer_dates(uuid, jsonb, jsonb, jsonb, date, date) to service_role;

commit;
