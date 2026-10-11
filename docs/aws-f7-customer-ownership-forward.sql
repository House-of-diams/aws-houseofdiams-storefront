-- F7 STAGING TEST CANDIDATE ONLY. Apply one time as hod_migration after the
-- read-only preflight passes; leave F6/F7 checkout write flags OFF.
-- The scoped SECURITY DEFINER ACL migration is already applied; do not rerun it.
-- This does not authorize production use or checkout activation.
-- Adds F6 customer ownership without repointing legacy auth.users FKs or
-- changing public.profiles/admin identity. Guest hash remains an owner type.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guard$
begin
  if current_user <> 'hod_migration' then raise exception 'Expected hod_migration'; end if;
  if not exists (select 1 from pg_roles where rolname = 'hod_app'
    and not rolsuper and not rolbypassrls) then
    raise exception 'hod_app role security contract differs';
  end if;
  if has_schema_privilege('hod_app', 'auth', 'USAGE') then
    raise exception 'hod_app auth schema access differs';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in (
      'orders', 'order_items', 'checkout_attempts', 'payment_webhook_events',
      'payment_recovery_actions', 'checkout_result_page', 'checkout_result_states')
      and c.relrowsecurity) <> 7 then
    raise exception 'F7 policy target RLS state differs';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public'
    and policyname like 'hod_app_f7_%') then
    raise exception 'F7 policy already exists; inspect before retry';
  end if;
  if to_regclass('public.customer_identities') is null then
    raise exception 'F6 identity table is missing';
  end if;
  if not has_column_privilege(current_user, 'public.customer_identities', 'id', 'REFERENCES') then
    raise exception 'Migration role lacks REFERENCES on customer_identities.id';
  end if;
  if exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name in
      ('orders', 'checkout_attempts', 'coupon_redemptions')
      and column_name = 'customer_identity_id') then
    raise exception 'F7 ownership column already exists; inspect before retry';
  end if;
  if not exists (select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass and conname = 'orders_checkout_owner_check'
      and pg_get_constraintdef(oid) =
        'CHECK ((((user_id IS NOT NULL) AND (guest_token_hash IS NULL)) OR ((user_id IS NULL) AND (guest_token_hash ~ ''^[0-9a-f]{64}$''::text))))') then
    raise exception 'orders owner check differs from read-only audit';
  end if;
  if not exists (select 1 from pg_constraint
    where conrelid = 'public.checkout_attempts'::regclass and conname = 'checkout_attempts_owner_check'
      and pg_get_constraintdef(oid) =
        'CHECK ((((user_id IS NOT NULL) AND (guest_token_hash IS NULL)) OR ((user_id IS NULL) AND (guest_token_hash ~ ''^[0-9a-f]{64}$''::text))))') then
    raise exception 'checkout_attempts owner check differs from read-only audit';
  end if;
end $guard$;

alter table public.orders add column customer_identity_id uuid
  references public.customer_identities(id) on delete restrict;
alter table public.checkout_attempts add column customer_identity_id uuid
  references public.customer_identities(id) on delete restrict;
alter table public.coupon_redemptions add column customer_identity_id uuid
  references public.customer_identities(id) on delete restrict;

alter table public.orders drop constraint orders_checkout_owner_check;
alter table public.orders add constraint orders_checkout_owner_check
  check (num_nonnulls(user_id, guest_token_hash, customer_identity_id) = 1
    and (guest_token_hash is null or guest_token_hash ~ '^[0-9a-f]{64}$'));
alter table public.checkout_attempts drop constraint checkout_attempts_owner_check;
alter table public.checkout_attempts add constraint checkout_attempts_owner_check
  check (num_nonnulls(user_id, guest_token_hash, customer_identity_id) = 1
    and (guest_token_hash is null or guest_token_hash ~ '^[0-9a-f]{64}$'));

create index orders_customer_identity_id_idx
  on public.orders (customer_identity_id, created_at desc)
  where customer_identity_id is not null;
create unique index checkout_attempts_customer_idempotency_uidx
  on public.checkout_attempts (customer_identity_id, idempotency_key)
  where customer_identity_id is not null;
create index coupon_redemptions_customer_identity_id_idx
  on public.coupon_redemptions (customer_identity_id)
  where customer_identity_id is not null;

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
    and pg_get_userbyid(proowner) = current_user
    and proconfig @> array['search_path=public']::text[]
    and has_function_privilege('hod_app', oid, 'EXECUTE')
    and not has_function_privilege('anon', oid, 'EXECUTE')
    and not has_function_privilege('authenticated', oid, 'EXECUTE')) then
    raise exception 'create_pending_order_v2 security/signature differs';
  end if;
  d := pg_get_functiondef(f);
  old_text := 'v_guest_token_hash text := lower(nullif(trim(p_order->>''guest_token_hash''), ''''));';
  new_text := old_text || E'\n  v_customer_identity_id uuid := nullif(trim(p_order->>''customer_identity_id''), '''')::uuid;';
  n := (length(d)-length(replace(d,old_text,'')))/length(old_text);
  if n <> 1 then raise exception 'create_pending_order_v2 identity declaration differs'; end if;
  d := replace(d,old_text,new_text);
  old_text := '(p_user_id is null and v_guest_token_hash is null)';
  new_text := '(num_nonnulls(p_user_id, v_guest_token_hash, v_customer_identity_id) = 0)';
  n := (length(d)-length(replace(d,old_text,'')))/length(old_text);
  if n <> 1 then raise exception 'create_pending_order_v2 null owner guard differs'; end if;
  d := replace(d,old_text,new_text);
  old_text := '(p_user_id is not null and v_guest_token_hash is not null)';
  new_text := '(num_nonnulls(p_user_id, v_guest_token_hash, v_customer_identity_id) > 1)';
  n := (length(d)-length(replace(d,old_text,'')))/length(old_text);
  if n <> 1 then raise exception 'create_pending_order_v2 double owner guard differs'; end if;
  d := replace(d,old_text,new_text);
  old_text := '    user_id,';
  new_text := old_text || E'\n    customer_identity_id,';
  n := (length(d)-length(replace(d,old_text,'')))/length(old_text);
  if n <> 1 then raise exception 'create_pending_order_v2 user column differs'; end if;
  d := replace(d,old_text,new_text);
  old_text := '    p_user_id,';
  new_text := old_text || E'\n    v_customer_identity_id,';
  n := (length(d)-length(replace(d,old_text,'')))/length(old_text);
  if n <> 1 then raise exception 'create_pending_order_v2 user value differs'; end if;
  execute replace(d,old_text,new_text);

  f := to_regprocedure('public.finalize_paid_order_with_coupon_secure(uuid,text,text,text,text,text,text,text,bigint,text,jsonb)');
  if f is null or not exists (select 1 from pg_proc where oid = f and prosecdef
    and pg_get_userbyid(proowner) = current_user
    and proconfig @> array['search_path=public']::text[]
    and has_function_privilege('hod_app', oid, 'EXECUTE')
    and not has_function_privilege('anon', oid, 'EXECUTE')
    and not has_function_privilege('authenticated', oid, 'EXECUTE')) then
    raise exception 'finalize_paid_order_with_coupon_secure security/signature differs';
  end if;
  d := pg_get_functiondef(f);
  old_text := 'coupon_id, coupon_code, user_id, order_id, order_number, discount_amount';
  new_text := 'coupon_id, coupon_code, user_id, customer_identity_id, order_id, order_number, discount_amount';
  n := (length(d)-length(replace(d,old_text,'')))/length(old_text);
  if n <> 1 then raise exception 'coupon finalizer column anchor differs'; end if;
  d := replace(d,old_text,new_text);
  old_text := 'v_coupon_row.id, v_coupon_row.code, v_order.user_id, v_order.id,';
  new_text := 'v_coupon_row.id, v_coupon_row.code, v_order.user_id, v_order.customer_identity_id, v_order.id,';
  n := (length(d)-length(replace(d,old_text,'')))/length(old_text);
  if n <> 1 then raise exception 'coupon finalizer value anchor differs'; end if;
  execute replace(d,old_text,new_text);
end $patch$;

-- Server-only hod_app is trusted across customers. Application queries must
-- derive the customer ID from the verified F6 session or a guest token hash.
-- Browser roles get no new grants or policies.
revoke all on public.orders, public.order_items, public.checkout_attempts,
  public.coupon_redemptions, public.inventory_reservations,
  public.payment_webhook_events, public.payment_recovery_actions from hod_app;
grant select, update on public.orders to hod_app;
grant select on public.order_items to hod_app;
grant select, insert, update on public.checkout_attempts to hod_app;
grant select, update on public.payment_webhook_events to hod_app;
grant select, update on public.payment_recovery_actions to hod_app;

create policy hod_app_f7_orders_select on public.orders
  for select to hod_app using (true);
create policy hod_app_f7_orders_update on public.orders
  for update to hod_app using (true) with check (true);
create policy hod_app_f7_order_items_select on public.order_items
  for select to hod_app using (true);
create policy hod_app_f7_attempts_select on public.checkout_attempts
  for select to hod_app using (true);
create policy hod_app_f7_attempts_insert on public.checkout_attempts
  for insert to hod_app with check (true);
create policy hod_app_f7_attempts_update on public.checkout_attempts
  for update to hod_app using (true) with check (true);
create policy hod_app_f7_webhook_events_select on public.payment_webhook_events
  for select to hod_app using (true);
create policy hod_app_f7_webhook_events_update on public.payment_webhook_events
  for update to hod_app using (true) with check (true);
create policy hod_app_f7_recovery_select on public.payment_recovery_actions
  for select to hod_app using (true);
create policy hod_app_f7_recovery_update on public.payment_recovery_actions
  for update to hod_app using (true) with check (true);
-- Existing success-page content grants SELECT to hod_app but its RLS policies
-- currently name only anon/authenticated, so hod_app sees zero rows.
create policy hod_app_f7_checkout_result_page_select on public.checkout_result_page
  for select to hod_app using (is_enabled = true);
create policy hod_app_f7_checkout_result_states_select on public.checkout_result_states
  for select to hod_app using (is_enabled = true);

commit;
