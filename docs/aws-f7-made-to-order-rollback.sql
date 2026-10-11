-- F7 PROPOSAL ONLY. Rollback refuses to remove made-to-order order state.
-- Apply only after confirming no made-to-order order exists and no payment is
-- in flight. This does not roll back the separate JPY patch.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guard$
begin
  if current_user <> 'hod_migration' then
    raise exception 'Expected reviewed function owner hod_migration';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'orders' and column_name = 'fulfillment_mode') then
    raise exception 'orders.fulfillment_mode is absent';
  end if;
  if exists (select 1 from public.orders where fulfillment_mode = 'made_to_order') then
    raise exception 'Made-to-order orders exist; preserve their fulfillment history';
  end if;
end $guard$;

do $patch$
declare
  item record;
  d text;
  old_text text;
  new_text text;
  occurrences integer;
begin
  for item in
    select p.oid, p.proname, pg_get_userbyid(p.proowner) function_owner
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
    d := pg_get_functiondef(item.oid);
    case item.proname
      when 'create_pending_order_v2' then
        new_text := '    user_id,' || E'\n    fulfillment_mode,';
        old_text := '    user_id,';
        occurrences := (length(d) - length(replace(d, new_text, ''))) / length(new_text);
        if occurrences <> 1 then raise exception 'create_pending_order_v2 column patch differs'; end if;
        d := replace(d, new_text, old_text);
        new_text := '    p_user_id,' || E'\n    coalesce(nullif(p_order->>''fulfillment_mode'', ''''), ''legacy_stock''),';
        old_text := '    p_user_id,';
        occurrences := (length(d) - length(replace(d, new_text, ''))) / length(new_text);
        if occurrences <> 1 then raise exception 'create_pending_order_v2 value patch differs'; end if;
        d := replace(d, new_text, old_text);
      when 'reserve_pending_order_item' then
        new_text := 'select id, status, payment_status, payment_gateway, created_at, fulfillment_mode';
        old_text := 'select id, status, payment_status, payment_gateway, created_at';
        occurrences := (length(d) - length(replace(d, new_text, ''))) / length(new_text);
        if occurrences <> 1 then raise exception 'reserve_pending_order_item select patch differs'; end if;
        d := replace(d, new_text, old_text);
        new_text := 'where id = new.order_id;' || E'\n\n  if found and v_order.fulfillment_mode = ''made_to_order'' then\n    return new;\n  end if;';
        old_text := 'where id = new.order_id;';
        occurrences := (length(d) - length(replace(d, new_text, ''))) / length(new_text);
        if occurrences <> 1 then raise exception 'reserve_pending_order_item branch patch differs'; end if;
        d := replace(d, new_text, old_text);
      when 'apply_order_stock_on_create' then
        new_text := E'if exists (select 1 from public.orders where id = new.order_id and fulfillment_mode = ''made_to_order'') then\n    return new;\n  end if;\n\n  if new.product_id is null then';
        old_text := 'if new.product_id is null then';
        occurrences := (length(d) - length(replace(d, new_text, ''))) / length(new_text);
        if occurrences <> 1 then raise exception 'apply_order_stock_on_create patch differs'; end if;
        d := replace(d, new_text, old_text);
      when 'restore_order_stock_on_cancel' then
        new_text := E'if new.fulfillment_mode = ''made_to_order'' then\n    return new;\n  end if;\n\n  if old.status = ''cancelled'' or new.status <> ''cancelled'' then';
        old_text := 'if old.status = ''cancelled'' or new.status <> ''cancelled'' then';
        occurrences := (length(d) - length(replace(d, new_text, ''))) / length(new_text);
        if occurrences <> 1 then raise exception 'restore_order_stock_on_cancel patch differs'; end if;
        d := replace(d, new_text, old_text);
      when 'guard_paid_order_inventory_reservation' then
        new_text := E'if exists (select 1 from public.orders where id = p_order_id and fulfillment_mode = ''made_to_order'') then\n    return query select true, null::text, ''Made-to-order inventory requires no reservation.'';\n    return;\n  end if;\n\n  if exists (';
        old_text := 'if exists (';
        occurrences := (length(d) - length(replace(d, new_text, ''))) / length(new_text);
        if occurrences <> 1 then raise exception 'guard_paid_order_inventory_reservation patch differs'; end if;
        d := replace(d, new_text, old_text);
      when 'finalize_paid_order_with_inventory_secure' then
        new_text := E'if v_order.fulfillment_mode <> ''made_to_order'' then\n  for v_item in';
        old_text := 'for v_item in';
        occurrences := (length(d) - length(replace(d, new_text, ''))) / length(new_text);
        if occurrences <> 1 then raise exception 'finalize_paid_order_with_inventory_secure branch patch differs'; end if;
        d := replace(d, new_text, old_text);
        new_text := E'end if;\n\n  v_gateway_payload :=';
        old_text := 'v_gateway_payload :=';
        occurrences := (length(d) - length(replace(d, new_text, ''))) / length(new_text);
        if occurrences <> 1 then raise exception 'finalize_paid_order_with_inventory_secure closing patch differs'; end if;
        d := replace(d, new_text, old_text);
    end case;
    execute d;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in (
      'create_pending_order_v2', 'reserve_pending_order_item',
      'apply_order_stock_on_create', 'restore_order_stock_on_cancel',
      'guard_paid_order_inventory_reservation',
      'finalize_paid_order_with_inventory_secure')) <> 6 then
    raise exception 'Expected exactly six unique function definitions';
  end if;
end $patch$;

alter table public.orders drop column fulfillment_mode;
commit;
