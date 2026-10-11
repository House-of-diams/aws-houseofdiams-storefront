-- READ ONLY verification after reviewed order-history migration.
begin read only;
select current_user database_role, current_setting('transaction_read_only') read_only;
select to_regclass('public.order_status_history') history_table;
select pg_get_triggerdef(t.oid) trigger_definition
from pg_trigger t where t.tgrelid = 'public.orders'::regclass
  and t.tgname = 'orders_record_status_history' and not t.tgisinternal;
select p.prosecdef security_definer, pg_get_userbyid(p.proowner) function_owner,
  p.proconfig
from pg_proc p where p.oid = to_regprocedure('public.record_order_status_history()');
select policyname, roles, cmd from pg_policies
where schemaname = 'public' and tablename = 'order_status_history';
select count(*)::bigint history_rows from public.order_status_history;
rollback;
