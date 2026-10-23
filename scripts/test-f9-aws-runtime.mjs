import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import ts from 'typescript'

// Deliberately loads no ENV file and cannot access persistence or providers.
function load(path, stubs = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText
  const exports = {}
  new Function('require', 'exports', js)((name) => {
    if (name === 'server-only') return {}
    if (Object.hasOwn(stubs, name)) return stubs[name]
    throw new Error(`Unmocked dependency: ${name}`)
  }, exports)
  return exports
}
function media(base) {
  process.env.NEXT_PUBLIC_MEDIA_CDN_BASE_URL = base
  return load('lib/media-url.ts', {}).mediaUrl
}

test('owned media keys resolve to the CDN', () => {
  const resolve = media('https://media.example.test/')
  assert.equal(resolve('products/a b.jpg'), 'https://media.example.test/products/a%20b.jpg')
  assert.equal(resolve('/products/a%20b.jpg'), 'https://media.example.test/products/a%20b.jpg')
})

test('external, CDN and bundled assets remain unchanged; unsafe schemes are rejected', () => {
  const resolve = media('https://media.example.test')
  for (const value of ['https://external.example.test/a.jpg', 'https://media.example.test/a.jpg', '/images/a.jpg', '/video/a.mp4', '/_next/static/a.png']) {
    assert.equal(resolve(value), value)
  }
  for (const value of [null, '', 'javascript:alert(1)', '//external.example.test/a.jpg']) assert.equal(resolve(value), '')
})

test('without a CDN a stored key is returned as it is and never rewritten to another provider', () => {
  const resolve = media('')
  assert.equal(resolve('products/a.jpg'), 'products/a.jpg')
})

test('storefront runtime contains no legacy SDK imports or provider ENV reads', () => {
  function inspect(directory) {
    for (const entry of readdirSync(new URL(`../${directory}/`, import.meta.url), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`
      if (entry.isDirectory()) inspect(path)
      else if (/\.(?:ts|tsx|js|jsx)$/.test(path)) {
        const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
        assert.doesNotMatch(source, /(?:from\s*|import\s*\()['"](?:@supabase\/|@\/lib\/(?:server-)?supabase)/, path)
        assert.doesNotMatch(source, /process\.env\.(?:[A-Z_]*(?:SUPABASE|R2|CLOUDFLARE|VERCEL)[A-Z_]*|HOD_F2_[A-Z_]+)/, path)
      }
    }
  }
  for (const directory of ['app', 'components', 'lib']) inspect(directory)
})

test('disabled payment routes reject before invoking any handler', async () => {
  for (const [path, method, dependency, handler, gate] of [
    ['checkout/place', 'POST', 'f7-checkout-handlers', 'handleF7Place', 'isF7WritePrepared'],
    ['checkout/cancel', 'POST', 'f7-checkout-handlers', 'handleF7Cancel', 'isF7WritePrepared'],
    ['payments/verify', 'POST', 'f7-checkout-handlers', 'handleF7Verify', 'isF7WritePrepared'],
    ['payments/webhook', 'POST', 'f7-webhook-handler', 'handleF7Webhook', 'isF7WritePrepared'],
  ]) {
    let calls = 0
    const route = load(`app/api/${path}/route.ts`, {
      'next/server': { NextResponse: { json: Response.json } },
      '@/lib/f7-write-prepared': { [gate]: () => false },
      [`@/lib/${dependency}`]: { [handler]: () => { calls++; throw new Error('must not execute') } },
    })
    const response = await route[method](new Request(`https://store.test/api/${path}`, { method }))
    assert.equal(response.status, 503, path)
    assert.equal(response.headers.get('cache-control'), 'no-store', path)
    assert.equal(calls, 0, path)
  }
})

// HOD-031: the duplicate /api/profile route was removed; the same guarantees are
// checked on the profile route the account page uses.
test('profile writes bind to the verified identity, preserve validation and reject cross-origin requests', async () => {
  let enabled = false, sameOrigin = true, writes = 0
  const route = load('app/api/customer-auth/profile/route.ts', {
    'next/server': { NextResponse: { json: Response.json } },
    '@/lib/customer-auth/config': { getCustomerAuthConfig: () => enabled ? { baseUrl: 'https://store.test' } : null },
    '@/lib/customer-auth/oidc': { customerAuthCookieNames: () => ({ session: 'session' }), getCustomerSession: async () => ({ id: 'verified-id', email: 'verified@example.test' }) },
    '@/lib/customer-auth/security': { isSameOriginMutation: () => sameOrigin, readBoundedJson: async (request) => ({ ok: true, value: await request.json() }) },
    '@/lib/rate-limit': { enforceRateLimit: async () => ({ ok: true }) },
    '@/lib/db/query': { query: async (sql, params) => {
      assert.match(sql, /insert into public\.customer_profiles/)
      assert.equal(params[0], 'verified-id', 'identity comes from the session, never the body')
      assert.ok(!params.includes('untrusted@example.test'), 'email is never written from the body')
      writes++
      return { rows: [] }
    } },
  })
  const request = (body) => new Request('https://store.test/api/customer-auth/profile', { method: 'PATCH', headers: { cookie: 'session=token' }, body: JSON.stringify(body) })
  const valid = { first_name: 'Test', last_name: 'Client', email: 'untrusted@example.test', identity_id: 'other-id' }
  assert.equal((await route.PATCH(request(valid))).status, 404)
  enabled = true
  sameOrigin = false
  assert.equal((await route.PATCH(request(valid))).status, 403)
  sameOrigin = true
  assert.equal((await route.PATCH(request({ ...valid, birth_date: '2026-02-30' }))).status, 400)
  assert.equal(writes, 0)
  const response = await route.PATCH(request(valid))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(writes, 1)
})

test('profile reads member-since from owned RDS identity and omits password data', async () => {
  const route = load('app/api/customer-auth/profile/route.ts', {
    'next/server': { NextResponse: { json: Response.json } },
    '@/lib/customer-auth/config': { getCustomerAuthConfig: () => ({ baseUrl: 'https://store.test' }) },
    '@/lib/customer-auth/oidc': { customerAuthCookieNames: () => ({ session: 'session' }), getCustomerSession: async () => ({ id: 'owned-id', email: 'member@example.test' }) },
    '@/lib/customer-auth/security': { isSameOriginMutation: () => true, readBoundedJson: async () => ({ ok: true, value: {} }) },
    '@/lib/db/query': { query: async (sql, params) => {
      assert.match(sql, /from public\.customer_identities i left join public\.customer_profiles p/)
      assert.deepEqual(params, ['owned-id'])
      return { rows: [{ identity_created_at: '2026-01-02T00:00:00Z', first_name: 'Member' }] }
    } },
    '@/lib/rate-limit': { enforceRateLimit: async () => ({ ok: true }) },
  })
  const result = await route.GET(new Request('https://store.test/api/customer-auth/profile'))
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), { identity: { id: 'owned-id', email: 'member@example.test', createdAt: '2026-01-02T00:00:00Z' }, profile: { first_name: 'Member' } })
})

test('password change starts an authenticated PKCE Keycloak action and returns to profile', async () => {
  let authenticated = false
  const route = load('app/api/customer-auth/start/route.ts', {
    'next/server': { NextResponse: {
      json: Response.json,
      redirect: (url, status) => {
        const response = new Response(null, { status, headers: { location: String(url) } })
        response.cookies = { set: () => {} }
        return response
      },
    } },
    '@/lib/customer-auth/config': { getCustomerAuthConfig: () => ({ issuer: 'https://auth.test/realms/hod-customers', baseUrl: 'https://store.test', clientId: 'client' }), safeNextPath: () => '/' },
    '@/lib/customer-auth/oidc': {
      customerAuthCookieNames: () => ({ session: 'session', state: 'state' }),
      getCustomerSession: async () => authenticated ? { id: 'owned-id' } : null,
      getDiscovery: async () => ({ authorization_endpoint: 'https://auth.test/authorize' }),
      makeState: (payload) => { assert.equal(payload.next, '/profile'); assert.ok(payload.nonce); assert.ok(payload.verifier); return 'signed-state' },
      stateCookieOptions: () => ({}),
    },
    '@/lib/rate-limit': { enforceRateLimit: async () => ({ ok: true }) },
  })
  const request = new Request('https://store.test/api/customer-auth/start?flow=password&next=%2F%2Fevil.test', { headers: { cookie: 'session=owned-token' } })
  assert.equal((await route.GET(request)).status, 401)
  authenticated = true
  const response = await route.GET(request)
  assert.equal(response.status, 302)
  const authorization = new URL(response.headers.get('location'))
  assert.equal(authorization.searchParams.get('kc_action'), 'UPDATE_PASSWORD')
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256')
  assert.ok(authorization.searchParams.get('state'))
  assert.ok(authorization.searchParams.get('nonce'))
  assert.equal(authorization.searchParams.get('redirect_uri'), 'https://store.test/api/customer-auth/callback')
  assert.equal(authorization.searchParams.get('prompt'), null)
})

test('RDS read failures return a bounded public error without database details', async () => {
  // HOD-057 removed the unused diamond-info route; this live public route has the same contract.
  const route = load('app/api/public/additional-summary-details/route.ts', {
    'next/server': { NextResponse: { json: Response.json } },
    '@/lib/repositories/summary-repository': { findAdditionalSummaryFromRds: async () => { throw new Error('private database credentials') } },
    '@/lib/public-cache': { cachePublicRead: (_key, read) => read, publicCacheHeaders: () => ({}), PUBLIC_CACHE_LONG_SECONDS: 300 },
  })
  const response = await route.GET()
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: 'Unable to load content.' })
})

test('HOD-030/036: unknown tax product is 404; a connection whose rollback failed is discarded', async () => {
  const tax = load('app/api/checkout/tax/route.ts', {
    'next/server': { NextResponse: { json: Response.json } },
    '@/lib/repositories/checkout-tax-repository': { loadCheckoutTaxFromRds: async () => ({}) },
  })
  const missing = await tax.GET(new Request('https://store.test/api/checkout/tax?slug=unknown'))
  assert.equal(missing.status, 404)
  assert.deepEqual(await missing.json(), { error: 'Product not found.' })
  const released = []
  const client = (rollbackFails) => ({
    query: async (sql) => { if (sql === 'ROLLBACK' && rollbackFails) throw Object.assign(Error('connection lost'), { code: '08006' }); return { rows: [] } },
    release: (discard) => released.push(discard),
  })
  for (const rollbackFails of [false, true]) {
    const { withTransaction } = load('lib/db/transaction.ts', {
      '@/lib/db/errors': { getPostgresErrorCode: (e) => e?.code, normalizePostgresError: (e) => e },
      '@/lib/db/pool': { getPool: () => ({ connect: async () => client(rollbackFails) }) },
    })
    await assert.rejects(withTransaction(async () => { throw Error('work failed') }), /work failed/)
  }
  assert.deepEqual(released, [false, true], 'healthy connection reused; broken one discarded')
})

test('HOD-071: a repeat newsletter signup answers exactly like a new one', async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://offline'
  let error = null
  const route = load('app/api/public/newsletter/submit/route.ts', {
    'next/server': { NextResponse: { json: Response.json } },
    '@/lib/db/errors': { getPostgresErrorCode: (e) => e?.code },
    '@/lib/repositories/public-forms-repository': { insertNewsletterSubmission: async () => { if (error) throw error } },
    '@/lib/rate-limit': { enforceRateLimit: async () => ({ ok: true }) },
    '@/lib/validation': { isValidEmail: () => true },
  })
  const post = () => route.POST(new Request('https://store.test/api/public/newsletter/submit', { method: 'POST', body: JSON.stringify({ email: ' A@Example.test ' }) }))
  const fresh = await post()
  error = Object.assign(Error('duplicate key'), { code: '23505' })
  const repeat = await post()
  assert.equal(repeat.status, fresh.status)
  assert.deepEqual(await repeat.json(), await fresh.json())
  error = Object.assign(Error('boom'), { code: '08006' })
  assert.equal((await post()).status, 500, 'other failures still report an error')
})
