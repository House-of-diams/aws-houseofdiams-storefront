import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { generateKeyPairSync, sign } from 'node:crypto'
import { validateIdentityToken, isSameOriginMutation, readBoundedJson } from '../lib/customer-auth/security.ts'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = publicKey.export({ format: 'jwk' })
const expected = { issuer: 'https://auth-uat.houseofdiams.com/realms/hod-customers', clientId: 'hod-storefront', nonce: 'test-nonce', now: 1000 }
const claims = { iss: expected.issuer, aud: expected.clientId, sub: 'customer-subject', email: 'CUSTOMER@example.com', email_verified: true, nonce: expected.nonce, iat: 900, exp: 1100 }
function token(overrides = {}, algorithm = 'RS256') {
  const header = Buffer.from(JSON.stringify({ alg: algorithm, kid: 'test-key' })).toString('base64url')
  const body = Buffer.from(JSON.stringify({ ...claims, ...overrides })).toString('base64url')
  const payload = `${header}.${body}`
  return `${payload}.${sign('RSA-SHA256', Buffer.from(payload), privateKey).toString('base64url')}`
}
test('accepts a signed customer token and normalizes its verified email', () => {
  assert.deepEqual(validateIdentityToken(token(), jwk, expected), { subject: claims.sub, email: 'customer@example.com', emailVerified: true, expiresAt: 1100 })
})
test('rejects forged token signatures and algorithm confusion', () => {
  const forged = token().split('.')
  forged[1] = Buffer.from(JSON.stringify({ ...claims, sub: 'another-customer' })).toString('base64url')
  assert.throws(() => validateIdentityToken(forged.join('.'), jwk, expected))
  assert.throws(() => validateIdentityToken(token({}, 'HS256'), jwk, expected))
})
test('rejects wrong issuer, audience, nonce and authorized party', () => {
  for (const change of [{ iss: expected.issuer.replace('hod-customers', 'hod-admin') }, { aud: 'hod-admin' }, { nonce: 'another-state' }, { azp: 'hod-admin' }, { aud: [expected.clientId, 'other'] }]) {
    assert.throws(() => validateIdentityToken(token(change), jwk, expected))
  }
})
test('rejects expired, future, missing-subject and unverified-email tokens', () => {
  for (const change of [{ exp: 1000 }, { iat: 1200 }, { nbf: 1100 }, { sub: '' }, { email_verified: false }, { email: '' }]) {
    assert.throws(() => validateIdentityToken(token(change), jwk, expected))
  }
})
test('requires the configured origin for profile/logout mutations', () => {
  const origin = 'https://uat.houseofdiams.com'
  assert.equal(isSameOriginMutation(new Request(`${origin}/api/customer-auth/logout`, { headers: { origin } }), origin), true)
  assert.equal(isSameOriginMutation(new Request(`${origin}/api/customer-auth/logout`, { headers: { origin: 'https://attacker.example' } }), origin), false)
  assert.equal(isSameOriginMutation(new Request(`${origin}/api/customer-auth/logout`), origin), false)
})

test('bounds profile JSON by actual streamed bytes even without Content-Length', async () => {
  const accepted = await readBoundedJson(new Request('https://store.test/profile', {
    method: 'PATCH', body: JSON.stringify({ city: 'Mumbai' }), headers: { 'content-type': 'application/json' },
  }), 32)
  assert.deepEqual(accepted, { ok: true, value: { city: 'Mumbai' } })

  const oversized = new Request('https://store.test/profile', {
    method: 'PATCH', body: JSON.stringify({ city: 'x'.repeat(128) }), headers: { 'content-type': 'application/json' },
  })
  assert.equal(oversized.headers.has('content-length'), false)
  assert.deepEqual(await readBoundedJson(oversized, 32), { ok: false, status: 413 })
})

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('customer auth is server gated and uses the separate customer realm', async () => {
  const [config, start, callback] = await Promise.all([
    read('lib/customer-auth/config.ts'),
    read('app/api/customer-auth/start/route.ts'),
    read('app/api/customer-auth/callback/route.ts'),
  ])
  assert.match(config, /HOD_CUSTOMER_AUTH_ENABLED !== 'true'/)
  assert.match(config, /HOD_CUSTOMER_OIDC_ISSUER/)
  assert.match(config, /hod-customers/)
  assert.match(start, /code_challenge_method: 'S256'/)
  assert.match(start, /code_challenge: challenge/)
  assert.match(callback, /verifyIdToken\(tokens\.id_token, discovery, statePayload\.nonce\)/)
  assert.doesNotMatch(`${config}\n${start}\n${callback}`, /NEXT_PUBLIC_.*(?:CLIENT_SECRET|SESSION_SECRET)/)
})

test('sessions persist only a hash and use a host-only secure cookie', async () => {
  const [oidc, forward] = await Promise.all([
    read('lib/customer-auth/oidc.ts'),
    read('docs/f6-customer-identity-forward.sql'),
  ])
  assert.match(oidc, /createHash\('sha256'\)/)
  assert.match(oidc, /httpOnly: true, secure: true, sameSite: 'lax' as const, path: '\/'/)
  assert.match(oidc, /customer_sessions \(identity_id, token_hash, expires_at\)/)
  assert.match(forward, /create table public\.customer_sessions/)
  assert.match(forward, /references public\.customer_identities\(id\) on delete cascade/)
  assert.doesNotMatch(forward, /references\s+auth\.users/i)
})

test('F6 SQL preserves current profile and commerce identity foreign keys', async () => {
  const forward = await read('docs/f6-customer-identity-forward.sql')
  assert.doesNotMatch(forward, /alter table public\.(profiles|orders|checkout_attempts|carts|wishlists|coupon_redemptions)/i)
  assert.doesNotMatch(forward, /grant .* on schema auth/i)
})
