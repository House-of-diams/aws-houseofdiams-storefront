-- F7 PROPOSAL ONLY. Refuses to discard order history once recorded.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $guard$
begin
  if current_user <> 'hod_migration' then raise exception 'Expected hod_migration'; end if;
  if to_regclass('public.order_status_history') is null then
    raise exception 'Order history table is absent';
  end if;
  if exists (select 1 from public.order_status_history) then
    raise exception 'Order history exists; preserve audit data';
  end if;
end $guard$;
drop trigger orders_record_status_history on public.orders;
drop function public.record_order_status_history();
drop table public.order_status_history restrict;
commit;
