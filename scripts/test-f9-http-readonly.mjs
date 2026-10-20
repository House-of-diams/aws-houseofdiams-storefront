import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { createServer } from 'node:net'
import { readFileSync, createWriteStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { Client } from 'pg'

process.loadEnvFile('.env.local')
const url = new URL(process.env.DATABASE_URL)
assert.ok(process.env.DB_TLS_EXPECTED_HOST && process.env.DB_CA_CERT_PATH)
url.hostname = process.env.DB_TLS_EXPECTED_HOST
url.port = '5432'
url.pathname = '/hod_f7_test'
url.searchParams.set('options', '-c default_transaction_read_only=on -c statement_timeout=30000')
const client = new Client({ connectionString: url.toString(), ssl: {
  rejectUnauthorized: true, ca: readFileSync(process.env.DB_CA_CERT_PATH, 'utf8'),
} })
const probe = createServer()
probe.listen(3019, '127.0.0.1')
await once(probe, 'listening')
await new Promise((resolve) => probe.close(resolve))
const output = createWriteStream(join(tmpdir(), 'hod-f9-http-server.txt'))
const child = spawn(process.execPath, ['scripts/build-f9-readonly.mjs', '--serve'], {
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
})
child.stdout.pipe(output)
child.stderr.pipe(output)
const base = 'http://127.0.0.1:3019'
let checks = 0
async function request(path, body) {
  checks++
  return fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'manual', signal: AbortSignal.timeout(60_000),
  })
}
const counts = async () => (await client.query(`select
  (select count(*) from public.orders)::int as orders,
  (select count(*) from public.checkout_attempts)::int as attempts,
  (select count(*) from public.order_items)::int as items,
  (select count(*) from public.order_status_history)::int as history`)).rows[0]
try {
  await client.connect()
  const state = (await client.query("select current_database() db, current_user role, current_setting('transaction_read_only') ro")).rows[0]
  assert.deepEqual(state, { db: 'hod_f7_test', role: 'hod_app', ro: 'on' })
  const before = await counts()
  let ready = false
  for (let attempt = 0; attempt < 40; attempt++) {
    if (child.exitCode !== null) throw new Error('Verification server exited')
    try { await fetch(`${base}/api/readiness/db`, { signal: AbortSignal.timeout(2000) }); ready = true; break } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  assert.ok(ready, 'Verification server did not become ready')
  for (const path of ['/api/readiness/db', '/api/public/home-hero', '/api/public/settings', '/api/public/footer-content',]) {
    const response = await request(path)
    assert.equal(response.status, 200, path)
    await response.json()
  }
  // Match authoritative checkout eligibility: standard is the default lane;
  // the explicit allow_checkout switch applies to Hip Hop only.
  const product = (await client.query("select slug, name from public.products where status='active' and coalesce(product_lane::text,'standard')='standard' order by slug limit 1")).rows[0]
  assert.ok(product, 'Expected an active clone product')
  const hydrated = await request('/api/public/products', { keys: [product.slug] })
  assert.equal(hydrated.status, 200)
  const items = (await hydrated.json()).items
  assert.equal(items.length, 1)
  assert.equal(items[0].slug, product.slug)
  if (items[0].imageUrl) assert.ok(items[0].imageUrl.startsWith(process.env.NEXT_PUBLIC_MEDIA_CDN_BASE_URL))
  const quote = await request('/api/checkout/quote', { currencyCode: 'USD', country: 'US', items: [{ ...product, quantity: 1 }] })
  assert.equal(quote.status, 200, 'USD quote')
  assert.equal((await quote.json()).quote.chargeCurrency, 'USD')
  const tax = await request(`/api/checkout/tax?slug=${encodeURIComponent(product.slug)}`)
  assert.equal(tax.status, 200)
  for (const path of ['/api/checkout/place', '/api/checkout/cancel', '/api/payments/verify', '/api/payments/webhook']) {
    const response = await request(path, {})
    assert.equal(response.status, 503, path)
    assert.equal(response.headers.get('cache-control'), 'no-store', path)
  }
  assert.equal((await request('/api/profile')).status, 404)
  assert.deepEqual(await counts(), before, 'Commerce rows changed during read-only verification')
  console.log(`PASS: ${checks} production HTTP checks with old-provider ENV blanked; commerce counts unchanged.`)
} finally {
  await client.end()
  if (child.exitCode === null) {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    else child.kill('SIGTERM')
  }
  output.end()
}
