import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import pg from 'pg'

process.loadEnvFile('.env.local')
assert.notEqual(process.env.HOD_CUSTOMER_AUTH_ENABLED, 'true', 'Saved auth flag must remain OFF')
assert.notEqual(process.env.HOD_F7_RDS_WRITE_PREPARED, 'true', 'Saved write flag must remain OFF')
const url = new URL(process.env.DATABASE_URL)
assert.ok(process.env.DB_TLS_EXPECTED_HOST && process.env.DB_CA_CERT_PATH)
url.hostname = process.env.DB_TLS_EXPECTED_HOST; url.port = '5432'
for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key)
const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 15000,
  ssl: { rejectUnauthorized: true, ca: readFileSync(process.env.DB_CA_CERT_PATH, 'utf8') } })
let server
try {
  await client.connect()
  await client.query('BEGIN READ ONLY')
  assert.equal((await client.query('select current_user role')).rows[0].role, 'hod_app')
  const product = (await client.query(`select slug, name from public.products
    where status = 'active' and product_lane = 'standard' and stock_quantity = 0 limit 1`)).rows[0]
  assert.ok(product, 'Expected zero-stock made-to-order sample is missing')
  const coupon = (await client.query(`select id, code from public.coupons
    where is_active = true and reward_type = 'free_gift' limit 1`)).rows[0]
  assert.ok(coupon)
  await client.query('ROLLBACK')
  const env = { ...process.env, DATABASE_URL: url.toString(), DB_TLS_EXPECTED_HOST: '',
    PGOPTIONS: '-c default_transaction_read_only=on',
    HOD_CUSTOMER_AUTH_ENABLED: 'true', HOD_F7_RDS_WRITE_PREPARED: 'true',
    HOD_CUSTOMER_OIDC_ISSUER: 'https://auth.example.invalid/realms/hod-customers',
    HOD_CUSTOMER_OIDC_CLIENT_ID: 'fake-test-client', HOD_CUSTOMER_OIDC_CLIENT_SECRET: 'fake-test-secret',
    HOD_CUSTOMER_AUTH_BASE_URL: 'https://store.example.invalid', HOD_CUSTOMER_SESSION_SECRET: 'x'.repeat(32),
    RAZORPAY_KEY_ID: 'fake-test-key', RAZORPAY_KEY_SECRET: 'fake-test-secret', RAZORPAY_WEBHOOK_SECRET: 'fake-webhook-secret' }
  // No real payment or login credentials in this process; every DB session is
  // read-only. Only rejection and read endpoints are exercised.
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3017', '-H', '127.0.0.1'],
    { env, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'] })
  const base = 'http://127.0.0.1:3017'
  let ready = false
  for (let i = 0; i < 30; i += 1) {
    if (server.exitCode !== null) throw new Error('Test server exited before readiness')
    try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  assert.ok(ready, 'Test server did not become ready')
  const request = (path, body, headers = {}) => fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  for (const path of ['/api/checkout/place', '/api/create-order']) {
    assert.equal((await request(path, { idempotencyKey: 'guard-test-idempotency' })).status, 503, path)
  }
  for (const path of ['/api/checkout/success?order=NONEXISTENT', '/api/profile/orders', '/api/checkout/profile']) {
    assert.equal((await request(path)).status, 401, path)
  }
  for (const path of ['/api/checkout/cancel', '/api/payments/verify']) {
    assert.equal((await request(path, {})).status, 401, path)
  }
  assert.equal((await request('/api/payments/webhook', {}, { 'x-razorpay-signature': '0'.repeat(64) })).status, 400, 'invalid webhook signature')
  const owner = { 'x-guest-checkout-token': 'a'.repeat(64) }
  const orderId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  assert.equal((await request('/api/checkout/cancel', { orderId }, owner)).status, 404)
  assert.equal((await request('/api/payments/verify', { orderId, razorpay_order_id: 'order_fake',
    razorpay_payment_id: 'pay_fake', razorpay_signature: 'fake' }, owner)).status, 404)
  assert.equal((await request('/api/checkout/success?order=NONEXISTENT', undefined, owner)).status, 404)
  const quote = await request('/api/checkout/quote', { currencyCode: 'USD', country: 'US',
    items: [{ slug: product.slug, name: product.name, quantity: 1 }] })
  assert.equal(quote.status, 200, 'RDS USD quote')
  const priced = await quote.json()
  assert.equal(priced.quote.chargeCurrency, 'USD'); assert.ok(priced.pricing.totalAmount > 0)
  const gift = await request('/api/checkout/coupon', { code: coupon.code,
    items: [{ slug: product.slug, name: product.name, quantity: 10 }] })
  assert.equal(gift.status, 200, `RDS gift coupon: ${gift.ok ? 'OK' : await gift.clone().text()}`)
  const gifted = await gift.json()
  assert.ok(gifted.coupon?.gift, 'Free gift response is missing')
  assert.equal((await request(`/api/checkout/tax?slug=${encodeURIComponent(product.slug)}`)).status, 200)
  await client.query('BEGIN READ ONLY')
  const counts = (await client.query(`select (select count(*) from public.orders)::int orders,
    (select count(*) from public.checkout_attempts)::int attempts, (select count(*) from public.order_items)::int items,
    (select count(*) from public.order_status_history)::int history`)).rows[0]
  assert.deepEqual(counts, { orders: 0, attempts: 0, items: 0, history: 0 })
  await client.query('ROLLBACK')
  console.log('PASS: 14 production HTTP guards/read checks; staging commerce rows remain zero. No real login/payment/provider event sent.')
} catch (error) {
  console.error('F7 read-only HTTP check failed.', { code: error.code || 'assertion',
    ...(error.code === 'ERR_ASSERTION' ? { assertion: error.message } : {}) })
  process.exitCode = 1
} finally {
  if (server && server.exitCode === null) { server.kill(); await once(server, 'exit') }
  await client.end()
}
