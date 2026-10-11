import { NextResponse } from 'next/server'
import { getCustomerAuthConfig, safeNextPath } from '@/lib/customer-auth/config'
import { customerAuthCookieNames, getDiscovery, makeState, stateCookieOptions } from '@/lib/customer-auth/oidc'
import { enforceRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const config = getCustomerAuthConfig()
  if (!config) return NextResponse.json({ error: 'Customer authentication is disabled.' }, { status: 404 })
  try {
    const limit = await enforceRateLimit(request, { key: 'customer-auth-start', limit: 20, windowSeconds: 60 })
    if (!limit.ok && limit.response) return limit.response
    const requestUrl = new URL(request.url)
    const flow = requestUrl.searchParams.get('flow')
    if (flow !== 'login' && flow !== 'signup' && flow !== 'google') return NextResponse.json({ error: 'Invalid authentication flow.' }, { status: 400 })
    const discovery = await getDiscovery()
    const state = crypto.randomUUID()
    const nonce = crypto.randomUUID()
    const verifier = crypto.randomUUID() + crypto.randomUUID() + crypto.randomUUID()
    const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url')
    const signedState = makeState({ state, nonce, verifier, next: safeNextPath(requestUrl.searchParams.get('next')), exp: Math.floor(Date.now() / 1000) + 600 })
    const authorization = new URL(discovery.authorization_endpoint)
    authorization.search = new URLSearchParams({ client_id: config.clientId, response_type: 'code', scope: 'openid email profile', redirect_uri: `${config.baseUrl}/api/customer-auth/callback`, state, nonce, code_challenge: challenge, code_challenge_method: 'S256', prompt: flow === 'signup' ? 'create' : 'login', ...(flow === 'google' ? { kc_idp_hint: 'google' } : {}) }).toString()
    // Keycloak supports prompt=create for hosted registration. Require that
    // capability in UAT before enabling the customer auth flag.
    const response = NextResponse.redirect(authorization, 302)
    response.cookies.set(customerAuthCookieNames().state, signedState, stateCookieOptions())
    response.headers.set('cache-control', 'no-store')
    return response
  } catch {
    return NextResponse.json({ error: 'Unable to start customer authentication.' }, { status: 503 })
  }
}
