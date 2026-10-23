import { NextResponse } from 'next/server'
import { getCustomerAuthConfig } from '@/lib/customer-auth/config'
import { SESSION_TTL_SECONDS, createCustomerSession, customerAuthCookieNames, exchangeAuthorizationCode, getDiscovery, readState, sessionCookieOptions, verifyIdToken } from '@/lib/customer-auth/oidc'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const config = getCustomerAuthConfig()
  if (!config) return NextResponse.json({ error: 'Customer authentication is disabled.' }, { status: 404 })
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const state = requestUrl.searchParams.get('state')
  const cookies = request.headers.get('cookie') || ''
  const rawState = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${customerAuthCookieNames().state}=`))?.slice(customerAuthCookieNames().state.length + 1)
  const statePayload = readState(rawState)
  const fail = NextResponse.redirect(new URL('/login?error=authentication', config.baseUrl), 303)
  fail.cookies.set(customerAuthCookieNames().state, '', { ...sessionCookieOptions(0), maxAge: 0 })
  if (requestUrl.searchParams.has('error') || !code || !state || !statePayload || statePayload.exp < Math.floor(Date.now() / 1000) || state !== statePayload.state) return fail
  try {
    const discovery = await getDiscovery()
    const tokens = await exchangeAuthorizationCode(code, statePayload.verifier, discovery)
    if (!tokens.id_token) throw new Error('Identity provider did not return an identity token.')
    const identity = await verifyIdToken(tokens.id_token, discovery, statePayload.nonce)
    const maxAge = SESSION_TTL_SECONDS
    if (maxAge <= 0) throw new Error('Identity token expired during authentication.')
    const bearer = await createCustomerSession(config.issuer, identity.subject, identity.email, identity.emailVerified, maxAge)
    const response = NextResponse.redirect(new URL(statePayload.next, config.baseUrl), 303)
    response.cookies.set(customerAuthCookieNames().state, '', { ...sessionCookieOptions(0), maxAge: 0 })
    response.cookies.set(customerAuthCookieNames().session, bearer, sessionCookieOptions(maxAge))
    response.headers.set('cache-control', 'no-store')
    response.headers.set('referrer-policy', 'no-referrer')
    return response
  } catch {
    return fail
  }
}
