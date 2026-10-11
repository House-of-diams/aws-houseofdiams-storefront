import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkServerIdentity } from 'node:tls'
import pg from 'pg'

process.loadEnvFile('.env.local')
const connectionString = process.env.DATABASE_URL
const caPath = process.env.DB_CA_CERT_PATH
const expectedHost = process.env.DB_TLS_EXPECTED_HOST
assert.ok(connectionString && caPath && expectedHost, 'RDS read-only connection settings are required')

const url = new URL(connectionString)
for (const option of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(option)
const client = new pg.Client({
  connectionString: url.toString(),
  connectionTimeoutMillis: 15_000,
  ssl: {
    ca: readFileSync(caPath, 'utf8'),
    rejectUnauthorized: true,
    checkServerIdentity: (_host, certificate) => checkServerIdentity(expectedHost, certificate),
  },
})

const anchors = new Map([
  ['create_pending_order_v2', [
    ["v_guest_token_hash text := lower(nullif(trim(p_order->>'guest_token_hash'), ''));", 1],
    ['(p_user_id is null and v_guest_token_hash is null)', 1],
    ['(p_user_id is not null and v_guest_token_hash is not null)', 1],
    ['    user_id,', 1],
    ['    p_user_id,', 1],
  ]],
  ['reserve_pending_order_item', [
    ['select id, status, payment_status, payment_gateway, created_at', 1],
    ['where id = new.order_id;', 1],
  ]],
  ['apply_order_stock_on_create', [['if new.product_id is null then', 1]]],
  ['restore_order_stock_on_cancel', [["if old.status = 'cancelled' or new.status <> 'cancelled' then", 1]]],
  ['guard_paid_order_inventory_reservation', [['if exists (', 1]]],
  ['finalize_paid_order_with_inventory_secure', [
    ['for v_item in', 2],
    ['v_gateway_payload :=', 1],
    ['v_expected_amount_subunits := round(coalesce(v_order.payment_amount, 0) * 100)::bigint;', 1],
  ]],
  ['finalize_paid_order_with_coupon_secure', [
    ['coupon_id, coupon_code, user_id, order_id, order_number, discount_amount', 1],
    ['v_coupon_row.id, v_coupon_row.code, v_order.user_id, v_order.id,', 1],
  ]],
])

try {
  await client.connect()
  await client.query('BEGIN READ ONLY')
  const role = (await client.query("select current_database() database, current_user role, current_setting('transaction_read_only') read_only")).rows[0]
  assert.deepEqual(role, { database: 'hod_staging', role: 'hod_app', read_only: 'on' })

  const requiredTables = (await client.query(`
    select name, to_regclass('public.' || name) is not null present
    from unnest(array['orders', 'order_items', 'checkout_attempts',
      'coupon_redemptions', 'customer_identities', 'customer_sessions',
      'customer_profiles', 'catalog_categories']) name`)).rows
  assert.ok(requiredTables.every((table) => table.present), 'Required F7 or F6 table is absent')

  const commerceRows = (await client.query(`
    select (select count(*) from public.orders)::int orders,
      (select count(*) from public.checkout_attempts)::int attempts,
      (select count(*) from public.order_items)::int items,
      (select count(*) from public.inventory_reservations)::int reservations`)).rows[0]
  assert.deepEqual(commerceRows, { orders: 0, attempts: 0, items: 0, reservations: 0 },
    'Staging commerce rows changed; review before applying F7 SQL')

  const appRole = (await client.query(`
    select rolsuper, rolbypassrls from pg_roles where rolname = 'hod_app'`)).rows[0]
  assert.deepEqual(appRole, { rolsuper: false, rolbypassrls: false }, 'hod_app privilege state changed')
  const authUsage = (await client.query(`
    select has_schema_privilege('hod_app', 'auth', 'USAGE') allowed`)).rows[0]
  assert.equal(authUsage.allowed, false, 'hod_app unexpectedly has auth schema access')

  const identityReference = (await client.query(`
    select pg_get_userbyid(c.relowner) owner,
      has_column_privilege('hod_migration', c.oid, 'id', 'REFERENCES') migration_references
    from pg_class c where c.oid = 'public.customer_identities'::regclass`)).rows[0]
  assert.equal(identityReference.owner, 'hod_dev_migration', 'Customer identity table owner changed')
  assert.equal(identityReference.migration_references, true,
    'hod_migration needs REFERENCES on customer_identities.id before the ownership migration')

  const expectedRlsTables = [
    'orders', 'order_items', 'checkout_attempts', 'payment_webhook_events',
    'payment_recovery_actions', 'checkout_result_page', 'checkout_result_states',
  ]
  const rlsTables = (await client.query(`
    select c.relname name, c.relrowsecurity enabled
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = any($1::text[])`, [expectedRlsTables])).rows
  assert.deepEqual(rlsTables.map((table) => table.name).sort(), [...expectedRlsTables].sort(),
    'An F7 policy target table is absent')
  assert.ok(rlsTables.every((table) => table.enabled), 'An F7 policy target has RLS disabled')
  const existingF7Policies = (await client.query(`
    select count(*)::int count from pg_policies
    where schemaname = 'public' and policyname like 'hod_app_f7_%'`)).rows[0]
  assert.equal(existingF7Policies.count, 0, 'F7 policies already exist; inspect before applying forward SQL')

  const columns = (await client.query(`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public' and (
      (table_name = 'orders' and column_name in ('fulfillment_mode', 'customer_identity_id'))
      or (table_name in ('checkout_attempts', 'coupon_redemptions') and column_name = 'customer_identity_id')
    )`)).rows
  assert.deepEqual(columns, [], 'F7 columns already exist; inspect before using forward SQL')
  const history = (await client.query("select to_regclass('public.order_status_history') is not null present")).rows[0]
  assert.equal(history.present, false, 'Order history already exists; inspect before using forward SQL')

  for (const [name, terms] of anchors) {
    const result = await client.query(`
      select pg_get_functiondef(p.oid) definition, p.prosecdef security_definer,
        pg_get_userbyid(p.proowner) owner,
        has_function_privilege('hod_app', p.oid, 'EXECUTE') app_execute,
        has_function_privilege('anon', p.oid, 'EXECUTE') anon_execute,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') legacy_execute
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = $1`, [name])
    assert.equal(result.rows.length, 1, `${name}: expected one function`)
    const { definition, owner, security_definer, app_execute, anon_execute, legacy_execute } = result.rows[0]
    assert.equal(owner, 'hod_migration', `${name}: owner changed`)
    if (security_definer) {
      assert.equal(anon_execute, false, `${name}: anon can execute`)
      assert.equal(legacy_execute, false, `${name}: authenticated can execute`)
      const direct = name === 'create_pending_order_v2' || name === 'finalize_paid_order_with_coupon_secure'
      assert.equal(app_execute, direct, `${name}: hod_app execution differs from ACL plan`)
    }
    for (const [term, expected] of terms) {
      assert.equal(definition.split(term).length - 1, expected, `${name}: audited SQL anchor changed`)
    }
  }
  console.log('F7 SQL preflight passed: read-only role, schema state, function ACLs, and audited SQL anchors.')
} finally {
  try { await client.query('ROLLBACK') } catch {}
  await client.end()
}
