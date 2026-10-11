import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { checkServerIdentity } from 'node:tls'
import pg from 'pg'

// Metadata only. The explicit clone target is enforced before connecting and
// again inside a read-only transaction. Never invokes business functions.
process.loadEnvFile('.env.local')
const url = new URL(process.env.F8_TEST_DATABASE_URL || process.env.DATABASE_URL)
if (!process.env.F8_TEST_DATABASE_URL) url.pathname = '/hod_f7_test'
assert.equal(decodeURIComponent(url.pathname), '/hod_f7_test')
const expectedHost = process.env.DB_TLS_EXPECTED_HOST
assert.ok(expectedHost && process.env.DB_CA_CERT_PATH)
url.hostname = expectedHost; url.port = '5432'
for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key)
const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 15000,
  options: '-c default_transaction_read_only=on -c statement_timeout=15000',
  ssl: { rejectUnauthorized: true, ca: readFileSync(process.env.DB_CA_CERT_PATH, 'utf8'),
    checkServerIdentity: (_host, cert) => checkServerIdentity(expectedHost, cert) } })
try {
  await client.connect(); await client.query('BEGIN READ ONLY')
  assert.deepEqual((await client.query("select current_user role, current_database() db, current_setting('transaction_read_only') ro")).rows[0],
    { role: 'hod_app', db: 'hod_f7_test', ro: 'on' })
  const functions = (await client.query(`select p.proname, p.oid::regprocedure::text signature,
    p.prosecdef, pg_get_userbyid(p.proowner) owner, p.proconfig,
    pg_get_function_result(p.oid) result, pg_get_functiondef(p.oid) definition,
    has_function_privilege('hod_app', p.oid, 'EXECUTE') app,
    has_function_privilege('anon', p.oid, 'EXECUTE') anon,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') authenticated,
    exists(select 1 from aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) acl
      where acl.grantee = 0 and acl.privilege_type = 'EXECUTE') public_execute
    from pg_proc p where p.oid = any(array[
      'public.claim_due_payment_recovery_actions(integer)'::regprocedure,
      'public.expire_inventory_reservations(integer)'::regprocedure,
      'public.claim_payment_recovery_action(uuid,text,bigint,text,text)'::regprocedure,
      'public.claim_payment_webhook_event(text,text,text,text,text,jsonb)'::regprocedure])`)).rows
  assert.equal(functions.length, 4)
  for (const fn of functions) {
    assert.equal(fn.prosecdef, true); assert.equal(fn.owner, 'hod_migration')
    assert.equal(fn.app, true); assert.equal(fn.anon, false); assert.equal(fn.authenticated, false)
    assert.equal(fn.public_execute, false); assert.ok(fn.proconfig.includes('search_path=public'))
  }
  const claim = functions.find((fn) => fn.proname === 'claim_due_payment_recovery_actions')
  assert.match(claim.definition, /skip locked/i); assert.match(claim.definition, /leased_until/)
  assert.match(claim.definition, /attempt_count/)
  const columns = (await client.query(`select column_name from information_schema.columns
    where table_schema='public' and table_name='payment_recovery_actions'`)).rows.map((row) => row.column_name)
  for (const name of ['id','order_id','payment_id','amount_subunits','currency','provider_refund_id',
    'attempt_count','leased_until','next_attempt_at','completed_at','last_error']) assert.ok(columns.includes(name))
  await client.query('select id, attempt_count, leased_until from public.payment_recovery_actions limit 1')
  writeFileSync('.codex-temp/f8-contract-functions.json', JSON.stringify(functions, null, 2))
  const foundation = (await client.query(`select p.proname, pg_get_functiondef(p.oid) definition
    from pg_proc p where p.oid = any(array[
      'public.create_pending_order_v2(uuid,jsonb,jsonb,jsonb,date,date)'::regprocedure,
      'public.reserve_pending_order_item()'::regprocedure,
      'public.finalize_paid_order_with_coupon_secure(uuid,text,text,text,text,text,text,text,bigint,text,jsonb)'::regprocedure,
      'public.finalize_paid_order_with_inventory_secure(uuid,text,text,text,text,text,text,text,bigint,text,jsonb)'::regprocedure])`)).rows
  const schema = (await client.query(`select table_name, column_name, data_type, is_nullable, column_default
    from information_schema.columns where table_schema='public' and table_name in ('orders','order_items','payment_webhook_events')
    order by table_name, ordinal_position`)).rows
  const constraints = (await client.query(`select conname, pg_get_constraintdef(oid) definition
    from pg_constraint where conrelid in ('public.order_items'::regclass, 'public.payment_recovery_actions'::regclass)
    and contype='c'`)).rows
  writeFileSync('.codex-temp/f8-foundation.json', JSON.stringify({ foundation, schema, constraints }, null, 2))
  const counts = (await client.query(`select
    (select count(*) from public.orders) as orders,
    (select count(*) from public.orders where notes like 'F8_SYNTHETIC:%') as f8_synthetic_orders,
    (select count(*) from public.payment_recovery_actions a join public.orders o on o.id=a.order_id
      where o.notes like 'F8_SYNTHETIC:%') as f8_synthetic_recovery_actions,
    (select count(*) from public.payment_webhook_events where event_id like 'event_f8_synthetic_%') as f8_synthetic_webhook_events`)).rows[0]
  writeFileSync('.codex-temp/f8-contract-counts.json', JSON.stringify(counts, null, 2))
  console.log('PASS: hod_f7_test read-only F8 signatures, definitions, ACLs and recovery SELECT; no mutations.')
} catch (error) {
  console.error('F8 contract check failed:', error.code || error.name)
  process.exitCode = 1
} finally {
  try { await client.query('ROLLBACK') } catch { /* connection may not exist */ }
  await client.end()
}
