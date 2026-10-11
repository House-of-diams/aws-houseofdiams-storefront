-- F7 PROPOSAL ONLY. Roll back ownership SQL before made-to-order SQL.
-- Refuses to discard any Keycloak-owned commerce row. Do not use if payment
-- or checkout is in flight. This restores the audited pre-F7 broad grants.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guard$
begin
  if current_user <> 'hod_migration' then raise exception 'Expected hod_migration'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'orders' and column_name = 'customer_identity_id') then
    raise exception 'F7 customer ownership is not installed';
  end if;
  if exists (select 1 from public.orders where customer_identity_id is not null)
    or exists (select 1 from public.checkout_attempts where customer_identity_id is not null)
    or exists (select 1 from public.coupon_redemptions where customer_identity_id is not null) then
    raise exception 'Keycloak-owned commerce rows exist; preserve their ownership';
  end if;
end $guard$;

do $patch$
declare
  f oid;
  d text;
  old_text text;
  new_text text;
  n integer;
begin
  f := to_regprocedure('public.create_pending_order_v2(uuid,jsonb,jsonb,jsonb,date,date)');
  if f is null or not exists (select 1 from pg_proc where oid = f and prosecdef
    and pg_get_userbyid(proowner) = current_user) then
    raise exception 'create_pending_order_v2 security/signature differs';
  end if;
  d := pg_get_functiondef(f);
  new_text := 'v_guest_token_hash text := lower(nullif(trim(p_order->>''guest_token_hash''), ''''));'
    || E'\n  v_customer_identity_id uuid := nullif(trim(p_order->>''customer_identity_id''), '''')::uuid;';
  old_text := 'v_guest_token_hash text := lower(nullif(trim(p_order->>''guest_token_hash''), ''''));';
  n := (length(d)-length(replace(d,new_text,'')))/length(new_text);
  if n <> 1 then raise exception 'create_pending_order_v2 identity patch differs'; end if;
  d := replace(d,new_text,old_text);
  new_text := '(num_nonnulls(p_user_id, v_guest_token_hash, v_customer_identity_id) = 0)';
  old_text := '(p_user_id is null and v_guest_token_hash is null)';
  n := (length(d)-length(replace(d,new_text,'')))/length(new_text);
  if n <> 1 then raise exception 'create_pending_order_v2 null owner patch differs'; end if;
  d := replace(d,new_text,old_text);
  new_text := '(num_nonnulls(p_user_id, v_guest_token_hash, v_customer_identity_id) > 1)';
  old_text := '(p_user_id is not null and v_guest_token_hash is not null)';
  n := (length(d)-length(replace(d,new_text,'')))/length(new_text);
  if n <> 1 then raise exception 'create_pending_order_v2 double owner patch differs'; end if;
  d := replace(d,new_text,old_text);
  new_text := '    user_id,' || E'\n    customer_identity_id,';
  old_text := '    user_id,';
  n := (length(d)-length(replace(d,new_text,'')))/length(new_text);
  if n <> 1 then raise exception 'create_pending_order_v2 customer column patch differs'; end if;
  d := replace(d,new_text,old_text);
  new_text := '    p_user_id,' || E'\n    v_customer_identity_id,';
  old_text := '    p_user_id,';
  n := (length(d)-length(replace(d,new_text,'')))/length(new_text);
  if n <> 1 then raise exception 'create_pending_order_v2 customer value patch differs'; end if;
  execute replace(d,new_text,old_text);

  f := to_regprocedure('public.finalize_paid_order_with_coupon_secure(uuid,text,text,text,text,text,text,text,bigint,text,jsonb)');
  if f is null or not exists (select 1 from pg_proc where oid = f and prosecdef
    and pg_get_userbyid(proowner) = current_user) then
    raise exception 'finalize_paid_order_with_coupon_secure security/signature differs';
  end if;
  d := pg_get_functiondef(f);
  new_text := 'coupon_id, coupon_code, user_id, customer_identity_id, order_id, order_number, discount_amount';
  old_text := 'coupon_id, coupon_code, user_id, order_id, order_number, discount_amount';
  n := (length(d)-length(replace(d,new_text,'')))/length(new_text);
  if n <> 1 then raise exception 'coupon finalizer column patch differs'; end if;
  d := replace(d,new_text,old_text);
  new_text := 'v_coupon_row.id, v_coupon_row.code, v_order.user_id, v_order.customer_identity_id, v_order.id,';
  old_text := 'v_coupon_row.id, v_coupon_row.code, v_order.user_id, v_order.id,';
  n := (length(d)-length(replace(d,new_text,'')))/length(new_text);
  if n <> 1 then raise exception 'coupon finalizer value patch differs'; end if;
  execute replace(d,new_text,old_text);
end $patch$;

drop policy hod_app_f7_orders_select on public.orders;
drop policy hod_app_f7_orders_update on public.orders;
drop policy hod_app_f7_order_items_select on public.order_items;
drop policy hod_app_f7_attempts_select on public.checkout_attempts;
drop policy hod_app_f7_attempts_insert on public.checkout_attempts;
drop policy hod_app_f7_attempts_update on public.checkout_attempts;
drop policy hod_app_f7_webhook_events_select on public.payment_webhook_events;
drop policy hod_app_f7_webhook_events_update on public.payment_webhook_events;
drop policy hod_app_f7_recovery_select on public.payment_recovery_actions;
drop policy hod_app_f7_recovery_update on public.payment_recovery_actions;
drop policy hod_app_f7_checkout_result_page_select on public.checkout_result_page;
drop policy hod_app_f7_checkout_result_states_select on public.checkout_result_states;

alter table public.orders drop constraint orders_checkout_owner_check;
alter table public.orders add constraint orders_checkout_owner_check
  check ((user_id is not null and guest_token_hash is null)
    or (user_id is null and guest_token_hash ~ '^[0-9a-f]{64}$'));
alter table public.checkout_attempts drop constraint checkout_attempts_owner_check;
alter table public.checkout_attempts add constraint checkout_attempts_owner_check
  check ((user_id is not null and guest_token_hash is null)
    or (user_id is null and guest_token_hash ~ '^[0-9a-f]{64}$'));

drop index public.orders_customer_identity_id_idx;
drop index public.checkout_attempts_customer_idempotency_uidx;
drop index public.coupon_redemptions_customer_identity_id_idx;
alter table public.coupon_redemptions drop column customer_identity_id;
alter table public.checkout_attempts drop column customer_identity_id;
alter table public.orders drop column customer_identity_id;

grant select, insert, update, delete on public.orders, public.order_items,
  public.checkout_attempts, public.coupon_redemptions,
  public.inventory_reservations, public.payment_webhook_events,
  public.payment_recovery_actions to hod_app;
commit;
