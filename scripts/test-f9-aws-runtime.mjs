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
const origins = load('lib/legacy-media-origins.ts')
function media(base) {
  process.env.NEXT_PUBLIC_MEDIA_CDN_BASE_URL = base
  return load('lib/media-url.ts', { '@/lib/legacy-media-origins': origins }).mediaUrl
}

test('owned media keys and historical URLs resolve to the CDN without old ENV', () => {
  const resolve = media('https://media.example.test/')
  assert.equal(resolve('products/a b.jpg'), 'https://media.example.test/products/a%20b.jpg')
  assert.equal(resolve('/products/a%20b.jpg'), 'https://media.example.test/products/a%20b.jpg')
  for (const origin of origins.legacyMediaOrigins) {
    const prefix = origin.type === 'public-storage' ? '/storage/v1/object/public/hod/' : '/'
    assert.equal(resolve(`https://${origin.host}${prefix}products/a.jpg`), 'https://media.example.test/products/a.jpg')
  }
  const storage = origins.legacyMediaOrigins.find((entry) => entry.type === 'public-storage')
  assert.equal(resolve(`https://${storage.host}/storage/v1/object/public/private/a.jpg`), '')
})

test('external, CDN and bundled assets remain unchanged; unsafe schemes are rejected', () => {
  const resolve = media('https://media.example.test')
  for (const value of ['https://external.example.test/a.jpg', 'https://media.example.test/a.jpg', '/images/a.jpg', '/video/a.mp4', '/_next/static/a.png']) {
    assert.equal(resolve(value), value)
  }
  for (const value of [null, '', 'javascript:alert(1)', '//external.example.test/a.jpg']) assert.equal(resolve(value), '')
})

test('missing CDN never reconnects owned historical media to an old provider', () => {
  const resolve = media('')
  for (const origin of origins.legacyMediaOrigins) assert.equal(resolve(`https://${origin.host}/a.jpg`), '')
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

test('profile writes bind to the verified identity, preserve validation and reject cross-origin requests', async () => {
  let enabled = false
  let sameOrigin = true
  let writes = 0
  const identity = { kind: 'customer', id: 'verified-id', email: 'verified@example.test' }
  const route = load('app/api/profile/route.ts', {
    'next/server': { NextResponse: { json: Response.json } },
    '@/lib/customer-auth/config': { getCustomerAuthConfig: () => enabled ? { baseUrl: 'https://store.test' } : null },
    '@/lib/f7-checkout-owner': { resolveF7CheckoutOwner: async () => identity },
    '@/lib/customer-auth/security': {
      isSameOriginMutation: () => sameOrigin,
      readBoundedJson: async (request) => ({ ok: true, value: await request.json() }),
    },
    '@/lib/rate-limit': { enforceRateLimit: async () => ({ ok: true }) },
    '@/lib/repositories/checkout-profile-repository': {
      loadCheckoutCustomerProfile: async () => ({ first_name: 'Test' }),
      saveCustomerProfile: async (id, fields) => {
        assert.equal(id, identity.id)
        assert.equal(fields.email, undefined)
        writes++
        return fields
      },
    },
  })
  const request = (body) => new Request('https://store.test/api/profile', { method: 'PATCH', body: JSON.stringify(body) })
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
  assert.equal((await response.json()).profile.email, identity.email)
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
