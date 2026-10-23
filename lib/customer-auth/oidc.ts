import 'server-only'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { query } from '@/lib/db/query'
import { getCustomerAuthConfig } from './config'
import { validateIdentityToken } from './security'

const STATE_COOKIE = '__Host-hod_customer_oidc_state'
const SESSION_COOKIE = '__Host-hod_customer_session'
const STATE_TTL_SECONDS = 600
/** A signed-in customer stays signed in for 7 days. The identity token only proves who signed in; it does not set the session length. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

type Discovery = { authorization_endpoint: string; token_endpoint: string; jwks_uri: string; issuer: string; end_session_endpoint?: string }
type StatePayload = { state: string; nonce: string; verifier: string; next: string; exp: number }
type SessionIdentity = { id: string; email: string; email_verified: boolean }

function b64url(data: Buffer | string) { return Buffer.from(data).toString('base64url') }
function randomToken(bytes = 32) { return randomBytes(bytes).toString('base64url') }
function sign(value: string, secret: string) { return createHmac('sha256', secret).update(value).digest('base64url') }

function encodeSigned(payload: object, secret: string) {
  const body = b64url(JSON.stringify(payload))
  return `${body}.${sign(body, secret)}`
}

function decodeSigned<T>(value: string | undefined, secret: string): T | null {
  if (!value) return null
  const [body, signature, extra] = value.split('.')
  if (!body || !signature || extra) return null
  const expected = Buffer.from(sign(body, secret))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T } catch { return null }
}

export function customerAuthCookieNames() { return { state: STATE_COOKIE, session: SESSION_COOKIE } }
export function stateCookieOptions() {
  return { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: STATE_TTL_SECONDS }
}
export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge }
}

export async function getDiscovery(): Promise<Discovery> {
  const config = getCustomerAuthConfig()
  if (!config) throw new Error('Customer authentication is disabled.')
  const response = await fetch(`${config.issuer}/.well-known/openid-configuration`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error('Unable to load customer identity provider metadata.')
  const discovery = await response.json() as Discovery
  if (discovery.issuer !== config.issuer || !discovery.authorization_endpoint || !discovery.token_endpoint || !discovery.jwks_uri) {
    throw new Error('Customer identity provider metadata failed validation.')
  }
  for (const endpoint of [discovery.authorization_endpoint, discovery.token_endpoint, discovery.jwks_uri]) {
    if (new URL(endpoint).origin !== new URL(config.issuer).origin) throw new Error('Customer identity provider endpoint origin is invalid.')
  }
  return discovery
}

export function makeState(payload: StatePayload) {
  const config = getCustomerAuthConfig()!
  return encodeSigned(payload, config.sessionSecret)
}

export function readState(value: string | undefined) {
  const config = getCustomerAuthConfig()!
  return decodeSigned<StatePayload>(value, config.sessionSecret)
}

export async function exchangeAuthorizationCode(code: string, verifier: string, discovery: Discovery) {
  const config = getCustomerAuthConfig()!
  const response = await fetch(discovery.token_endpoint, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10000),
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: `${config.baseUrl}/api/customer-auth/callback`, client_id: config.clientId, client_secret: config.clientSecret, code_verifier: verifier }),
  })
  if (!response.ok) throw new Error('Customer identity provider rejected the authorization code.')
  return await response.json() as { id_token?: string; expires_in?: number }
}

export async function verifyIdToken(token: string, discovery: Discovery, expectedNonce: string) {
  const config = getCustomerAuthConfig()!
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid identity token.')
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as { alg?: string; kid?: string }
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported identity token signing algorithm.')
  const keyResponse = await fetch(discovery.jwks_uri, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!keyResponse.ok) throw new Error('Unable to load identity provider signing keys.')
  const keys = await keyResponse.json() as { keys?: Array<{ kid: string; kty: string; n: string; e: string; alg?: string }> }
  const jwk = keys.keys?.find((key) => key.kid === header.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256'))
  if (!jwk) throw new Error('Identity token signing key was not found.')
  return validateIdentityToken(token, jwk, { issuer: config.issuer, clientId: config.clientId, nonce: expectedNonce })
}

export async function createCustomerSession(issuer: string, subject: string, email: string, emailVerified: boolean, maxAge: number) {
  const identity = await query<{ id: string }>(
    `insert into public.customer_identities (issuer, subject, email, email_verified)
     values ($1, $2, $3, $4)
     on conflict (issuer, subject) do update set email = excluded.email, email_verified = excluded.email_verified, updated_at = now()
     returning id`, [issuer, subject, email, emailVerified], { operation: 'customer-auth-upsert-identity' },
  )
  const bearer = randomToken(32)
  const digest = createHash('sha256').update(bearer).digest()
  await query(`insert into public.customer_sessions (identity_id, token_hash, expires_at) values ($1, $2, now() + ($3 * interval '1 second'))`, [identity.rows[0].id, digest, maxAge], { operation: 'customer-auth-create-session' })
  // HOD-032: each sign-in removes this customer's own expired sessions (one bounded
  // statement, nothing scheduled). A failure here never blocks the sign-in.
  await query('delete from public.customer_sessions where identity_id = $1 and expires_at < now()', [identity.rows[0].id], { operation: 'customer-auth-purge-expired-sessions' })
    .catch(() => undefined)
  return bearer
}

export async function getCustomerSession(bearer: string | undefined): Promise<SessionIdentity | null> {
  if (!bearer || bearer.length > 128) return null
  const digest = createHash('sha256').update(bearer).digest()
  const result = await query<SessionIdentity>(
    `select i.id, i.email, i.email_verified from public.customer_sessions s
     join public.customer_identities i on i.id = s.identity_id
     where s.token_hash = $1 and s.expires_at > now() limit 1`, [digest], { operation: 'customer-auth-read-session' },
  )
  return result.rows[0] ?? null
}

export async function deleteCustomerSession(bearer: string | undefined) {
  if (!bearer || bearer.length > 128) return
  const digest = createHash('sha256').update(bearer).digest()
  await query('delete from public.customer_sessions where token_hash = $1', [digest], { operation: 'customer-auth-delete-session' })
}
