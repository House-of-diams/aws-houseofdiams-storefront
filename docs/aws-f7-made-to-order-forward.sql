-- F7 STAGING TEST CANDIDATE ONLY, after the applied customer-ownership SQL.
-- Run once as hod_migration after read-only verification; keep F6/F7 checkout
-- write flags OFF. This is not approval for production or payment activation.
-- The scoped ACL migration is already applied and must not be rerun.
-- Existing orders retain legacy_stock; only explicitly marked new storefront
-- orders use made_to_order. Admin/manual inserts keep their current default.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guard$
begin
  if current_user <> 'hod_migration' then
    raise exception 'Expected reviewed function owner hod_migration';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'orders' and column_name = 'fulfillment_mode') then
    raise exception 'orders.fulfillment_mode already exists; inspect before retry';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'hod_app'
    and not rolsuper and not rolbypassrls) then
    raise exception 'hod_app role security contract differs';
  end if;
end $guard$;

alter table public.orders add column fulfillment_mode text not null default 'legacy_stock'
  constraint orders_fulfillment_mode_check
  check (fulfillment_mode in ('legacy_stock', 'made_to_order'));

-- Transform only audited fragments of the installed functions. Each patch
-- aborts if its target is absent/duplicated or owner/security differs. This
-- preserves unrelated installed logic and the existing function grants.
do $patch$
declare
  item record;
  d text;
  before_text text;
  after_text text;
  occurrence_count integer;
  loop_start integer;
begin
  for item in
    select p.oid, p.proname, p.prosecdef, p.proconfig,
      pg_get_userbyid(p.proowner) function_owner,
      has_function_privilege('hod_app', p.oid, 'EXECUTE') app_execute,
      has_function_privilege('anon', p.oid, 'EXECUTE') anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') legacy_execute
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'create_pending_order_v2', 'reserve_pending_order_item',
      'apply_order_stock_on_create', 'restore_order_stock_on_cancel',
      'guard_paid_order_inventory_reservation',
      'finalize_paid_order_with_inventory_secure')
  loop
    if item.function_owner <> current_user then
      raise exception 'Function % owner differs', item.proname;
    end if;
    if item.proname not in ('apply_order_stock_on_create', 'restore_order_stock_on_cancel')
       and (item.anon_execute or item.legacy_execute
         or item.app_execute <> (item.proname = 'create_pending_order_v2')) then
      raise exception 'Function % ACL differs from applied F7 restriction', item.proname;
    end if;
    if item.proname in ('create_pending_order_v2', 'reserve_pending_order_item',
        'guard_paid_order_inventory_reservation',
        'finalize_paid_order_with_inventory_secure')
       and (not item.prosecdef or not (item.proconfig @> array['search_path=public']::text[])) then
      raise exception 'Function % security contract differs', item.proname;
    end if;
    d := pg_get_functiondef(item.oid);
    case item.proname
      when 'create_pending_order_v2' then
        before_text := '    user_id,';
        after_text := '    user_id,' || E'\n    fulfillment_mode,';
        occurrence_count := (length(d) - length(replace(d, before_text, ''))) / length(before_text);
        if occurrence_count <> 1 then raise exception 'create_pending_order_v2 column anchor differs'; end if;
        d := replace(d, before_text, after_text);
        before_text := '    p_user_id,';
        after_text := '    p_user_id,' || E'\n    coalesce(nullif(p_order->>''fulfillment_mode'', ''''), ''legacy_stock''),';
        occurrence_count := (length(d) - length(replace(d, before_text, ''))) / length(before_text);
        if occurrence_count <> 1 then raise exception 'create_pending_order_v2 value anchor differs'; end if;
        d := replace(d, before_text, after_text);
      when 'reserve_pending_order_item' then
        before_text := 'select id, status, payment_status, payment_gateway, created_at';
        after_text := 'select id, status, payment_status, payment_gateway, created_at, fulfillment_mode';
        occurrence_count := (length(d) - length(replace(d, before_text, ''))) / length(before_text);
        if occurrence_count <> 1 then raise exception 'reserve_pending_order_item select differs'; end if;
        d := replace(d, before_text, after_text);
        before_text := 'where id = new.order_id;';
        after_text := 'where id = new.order_id;' || E'\n\n  if found and v_order.fulfillment_mode = ''made_to_order'' then\n    return new;\n  end if;';
        occurrence_count := (length(d) - length(replace(d, before_text, ''))) / length(before_text);
        if occurrence_count <> 1 then raise exception 'reserve_pending_order_item owner anchor differs'; end if;
        d := replace(d, before_text, after_text);
      when 'apply_order_stock_on_create' then
        before_text := 'if new.product_id is null then';
        after_text := E'if exists (select 1 from public.orders where id = new.order_id and fulfillment_mode = ''made_to_order'') then\n    return new;\n  end if;\n\n  if new.product_id is null then';
        occurrence_count := (length(d) - length(replace(d, before_text, ''))) / length(before_text);
        if occurrence_count <> 1 then raise exception 'apply_order_stock_on_create anchor differs'; end if;
        d := replace(d, before_text, after_text);
      when 'restore_order_stock_on_cancel' then
        before_text := 'if old.status = ''cancelled'' or new.status <> ''cancelled'' then';
        after_text := E'if new.fulfillment_mode = ''made_to_order'' then\n    return new;\n  end if;\n\n  if old.status = ''cancelled'' or new.status <> ''cancelled'' then';
        occurrence_count := (length(d) - length(replace(d, before_text, ''))) / length(before_text);
        if occurrence_count <> 1 then raise exception 'restore_order_stock_on_cancel anchor differs'; end if;
        d := replace(d, before_text, after_text);
      when 'guard_paid_order_inventory_reservation' then
        before_text := 'if exists (';
        after_text := E'if exists (select 1 from public.orders where id = p_order_id and fulfillment_mode = ''made_to_order'') then\n    return query select true, null::text, ''Made-to-order inventory requires no reservation.'';\n    return;\n  end if;\n\n  if exists (';
        occurrence_count := (length(d) - length(replace(d, before_text, ''))) / length(before_text);
        if occurrence_count <> 1 then raise exception 'guard_paid_order_inventory_reservation anchor differs'; end if;
        d := replace(d, before_text, after_text);
      when 'finalize_paid_order_with_inventory_secure' then
        before_text := 'for v_item in';
        occurrence_count := (length(d) - length(replace(d, before_text, ''))) / length(before_text);
        if occurrence_count <> 2 then raise exception 'finalize_paid_order_with_inventory_secure inventory loop count differs'; end if;
        loop_start := position(before_text in d);
        d := substr(d, 1, loop_start - 1)
          || E'if v_order.fulfillment_mode <> ''made_to_order'' then\n  '
          || substr(d, loop_start);
        before_text := 'v_gateway_payload :=';
        after_text := E'end if;\n\n  v_gateway_payload :=';
        occurrence_count := (length(d) - length(replace(d, before_text, ''))) / length(before_text);
        if occurrence_count <> 1 then raise exception 'finalize_paid_order_with_inventory_secure gateway anchor differs'; end if;
        d := replace(d, before_text, after_text);
    end case;
    execute d;
  end loop;
  if not found then raise exception 'Expected payment functions missing'; end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in (
      'create_pending_order_v2', 'reserve_pending_order_item',
      'apply_order_stock_on_create', 'restore_order_stock_on_cancel',
      'guard_paid_order_inventory_reservation',
      'finalize_paid_order_with_inventory_secure')) <> 6 then
    raise exception 'Expected exactly six unique function definitions';
  end if;
end $patch$;

commit;
