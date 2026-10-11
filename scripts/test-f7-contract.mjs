import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkServerIdentity } from 'node:tls'
import pg from 'pg'
import ts from 'typescript'

process.loadEnvFile('.env.local')
const url = new URL(process.env.DATABASE_URL)
const expectedHost = process.env.DB_TLS_EXPECTED_HOST
assert.ok(expectedHost && process.env.DB_CA_CERT_PATH)
// Process-only direct connection; saved tunnel configuration is unchanged.
url.hostname = expectedHost
url.port = '5432'
for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key)
const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 15000,
  ssl: { rejectUnauthorized: true, ca: readFileSync(process.env.DB_CA_CERT_PATH, 'utf8'),
    checkServerIdentity: (_host, cert) => checkServerIdentity(expectedHost, cert) } })
try {
  await client.connect()
  await client.query('BEGIN READ ONLY')
  assert.deepEqual((await client.query("select current_user role, current_database() db, current_setting('transaction_read_only') ro")).rows[0],
    { role: 'hod_app', db: 'hod_staging', ro: 'on' })
  assert.deepEqual((await client.query("select rolsuper, rolbypassrls from pg_roles where rolname = current_user")).rows[0],
    { rolsuper: false, rolbypassrls: false })
  const roster = [...readFileSync('docs/aws-f7-function-acl-verify.sql', 'utf8')
    .matchAll(/\('public\.([^']+)', (true|false)\)/g)].map((match) => ({ signature: match[1], app: match[2] === 'true' }))
  assert.equal(roster.length, 15)
  const functions = (await client.query(`select p.proname, p.oid::regprocedure::text signature,
    p.prosecdef, pg_get_userbyid(p.proowner) owner, p.proconfig,
    pg_get_function_arguments(p.oid) args,
    pg_get_function_result(p.oid) result, pg_get_functiondef(p.oid) definition,
    has_function_privilege('hod_app', p.oid, 'EXECUTE') app,
    has_function_privilege('anon', p.oid, 'EXECUTE') anon,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') authenticated
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and p.proname=any($1::text[]) order by p.proname`, [roster.map(({ signature }) => signature.split('(')[0])])).rows
  assert.equal(functions.length, 15)
  for (const f of functions) {
    const expected = roster.find(({ signature }) => signature === f.signature.replace(/^public\./, ''))
    assert.ok(expected, 'Unexpected function overload/signature')
    assert.equal(f.anon, false); assert.equal(f.authenticated, false)
    assert.equal(f.app, expected.app)
    assert.equal(f.prosecdef, true); assert.equal(f.owner, 'hod_migration')
    assert.ok(f.proconfig.includes('search_path=public'))
  }
  const definitions = new Map(functions.map((f) => [f.proname, f.definition]))
  assert.match(definitions.get('create_pending_order_v2'), /customer_identity_id/)
  assert.match(definitions.get('create_pending_order_v2'), /fulfillment_mode/)
  assert.match(definitions.get('finalize_paid_order_with_inventory_secure'), /when 'JPY' then round/)
  assert.match(definitions.get('finalize_paid_order_with_inventory_secure'), /fulfillment_mode <> 'made_to_order'/)
  assert.match(definitions.get('finalize_paid_order_with_coupon_secure'), /customer_identity_id/)
  assert.match(definitions.get('reserve_pending_order_item'), /fulfillment_mode/)
  assert.match(definitions.get('guard_paid_order_inventory_reservation'), /fulfillment_mode/)
  const stockTriggers = (await client.query(`select pg_get_functiondef(p.oid) definition from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
    and p.proname = any($1::text[])`, [['apply_order_stock_on_create', 'restore_order_stock_on_cancel']])).rows
  assert.equal(stockTriggers.length, 2)
  for (const trigger of stockTriggers) assert.match(trigger.definition, /fulfillment_mode/)
  const columns = (await client.query(`select table_name, column_name, data_type
    from information_schema.columns where table_schema='public' and table_name=any($1::text[])
    order by table_name, ordinal_position`, [['orders','checkout_attempts','coupon_redemptions','payment_recovery_actions','payment_webhook_events','catalog_categories','order_status_history']])).rows
  for (const table of ['orders', 'checkout_attempts']) {
    assert.ok(columns.some((c) => c.table_name === table && c.column_name === 'customer_identity_id' && c.data_type === 'uuid'))
  }
  assert.ok(columns.some((c) => c.table_name === 'orders' && c.column_name === 'fulfillment_mode'))
  const constraints = (await client.query(`select conname, pg_get_constraintdef(oid) definition from pg_constraint
    where conname = any($1::text[])`, [['orders_checkout_owner_check','checkout_attempts_owner_check','orders_fulfillment_mode_check']])).rows
  assert.equal(constraints.length, 3)
  for (const constraint of constraints.filter((c) => c.conname.includes('owner'))) assert.match(constraint.definition, /num_nonnulls.*customer_identity_id.*= 1/)
  const history = (await client.query(`select c.relrowsecurity, has_table_privilege('hod_app', c.oid, 'SELECT') app_select
    from pg_class c where c.oid = 'public.order_status_history'::regclass`)).rows[0]
  assert.deepEqual(history, { relrowsecurity: true, app_select: true })
  assert.equal((await client.query(`select count(*)::int count from pg_trigger where tgrelid = 'public.orders'::regclass
    and tgname = 'orders_record_status_history' and not tgisinternal and tgenabled = 'O'`)).rows[0].count, 1)
  assert.deepEqual((await client.query(`select has_table_privilege('hod_app', 'public.orders', 'INSERT') order_insert,
    has_table_privilege('hod_app', 'public.inventory_reservations', 'SELECT') reservation_select,
    has_table_privilege('hod_app', 'public.coupon_redemptions', 'SELECT') redemption_select,
    has_table_privilege('anon', 'public.order_status_history', 'SELECT') anon_history,
    has_table_privilege('authenticated', 'public.order_status_history', 'SELECT') legacy_history`)).rows[0],
    { order_insert: false, reservation_select: false, redemption_select: false, anon_history: false, legacy_history: false })
  const counts = (await client.query(`select (select count(*) from public.orders)::int orders,
    (select count(*) from public.checkout_attempts)::int attempts,
    (select count(*) from public.order_items)::int items,
    (select count(*) from public.order_status_history)::int history`)).rows[0]
  assert.deepEqual(counts, { orders: 0, attempts: 0, items: 0, history: 0 })

  // Execute actual read repositories in this same READ ONLY transaction.
  // Transaction and write-gate dependencies are deliberately unavailable.
  let readQueue = Promise.resolve()
  const liveQuery = { query: (sql, values) => {
    const task = readQueue.then(() => client.query(sql, values))
    readQueue = task.catch(() => {})
    return task
  } }
  function loadRepository(path) {
    const output = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText
    const exports = {}
    new Function('require', 'exports', output)((name) => {
      if (name === 'server-only') return {}
      if (name === '@/lib/db/query') return liveQuery
      if (name === '@/lib/db/transaction') return { withTransaction: () => { throw new Error('Mutation forbidden') } }
      if (name === '@/lib/f7-write-prepared') return { requireF7WritePrepared: () => { throw new Error('Mutation forbidden') } }
      throw new Error('Unapproved live-read dependency')
    }, exports)
    return exports
  }
  const checkout = loadRepository('lib/repositories/checkout-repository.ts')
  const guest = { kind: 'guest', hash: 'a'.repeat(64) }
  const customer = { kind: 'customer', id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'test@example.invalid' }
  assert.equal(await checkout.findOwnedOrder(guest, { number: 'NONEXISTENT-F7-CONTRACT' }), null)
  assert.equal(await checkout.findOwnedOrder(customer, { number: 'NONEXISTENT-F7-CONTRACT' }), null)
  assert.equal(await checkout.findGatewayOrder('NONEXISTENT-F7-CONTRACT'), null)
  assert.deepEqual(await checkout.listOrderItems(guest, customer.id), [])
  assert.deepEqual(await checkout.listOrderHistory(customer, customer.id), [])
  const attempts = loadRepository('lib/repositories/checkout-attempt-repository.ts')
  assert.equal(await attempts.findCheckoutAttempt(customer, 'NONEXISTENT-F7-CONTRACT'), null)
  const profile = loadRepository('lib/repositories/checkout-profile-repository.ts')
  assert.equal(await profile.loadCheckoutCustomerProfile(customer.id), null)
  assert.deepEqual(await profile.loadCheckoutDropdownGroups([customer.id]), [])
  assert.deepEqual(await profile.loadCheckoutDropdownOptions([customer.id]), [])
  const orders = loadRepository('lib/repositories/customer-orders-repository.ts')
  assert.deepEqual(await orders.listCustomerOrders(customer, 1, 5), { orders: [], total: 0 })
  const content = await loadRepository('lib/repositories/checkout-result-repository.ts').loadCheckoutResultContent('success')
  assert.ok(content.page, 'Enabled success page content is not readable')
  assert.ok(content.state, 'Enabled success state content is not readable')
  assert.ok(content.categories.length, 'Active catalog categories are not readable')
  console.log('PASS: hod_app strict TLS, 15 signatures/ACLs, ownership/fulfillment/JPY/history, live read repositories; zero commerce rows.')
  await client.query('ROLLBACK')
} catch (error) {
  console.error('F7 read-only contract check failed.', { code: error.code || 'assertion',
    ...(error.code === 'ERR_ASSERTION' ? { assertion: error.message.split('\n')[0] } : {}) })
  process.exitCode = 1
} finally { await client.end() }
