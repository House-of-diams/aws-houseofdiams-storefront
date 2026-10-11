import { NextResponse } from 'next/server'
import { getCustomerAuthConfig } from '@/lib/customer-auth/config'
import { customerAuthCookieNames, deleteCustomerSession, getDiscovery, sessionCookieOptions } from '@/lib/customer-auth/oidc'
import { isSameOriginMutation } from '@/lib/customer-auth/security'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const config = getCustomerAuthConfig()
  if (!config) return NextResponse.json({ error: 'Customer authentication is disabled.' }, { status: 404 })
  if (!isSameOriginMutation(request, config.baseUrl)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  const name = customerAuthCookieNames().session
  const bearer = (request.headers.get('cookie') || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1)
  try { await deleteCustomerSession(bearer) } catch {
    return NextResponse.json({ error: 'Unable to end the customer session.' }, { status: 503 })
  }
  // client_id permits RP logout without retaining an ID token; Keycloak can
  // show a logout confirmation before returning to the registered app URL.
  let redirect = `${config.baseUrl}/`
  try {
    const discovery = await getDiscovery()
    if (discovery.end_session_endpoint) {
      const logout = new URL(discovery.end_session_endpoint)
      if (logout.origin !== new URL(config.issuer).origin) throw new Error('Invalid logout origin.')
      logout.search = new URLSearchParams({ client_id: config.clientId, post_logout_redirect_uri: redirect }).toString()
      redirect = logout.toString()
    }
  } catch {
    // The local session is already invalidated even if provider logout is down.
  }
  const response = NextResponse.json({ ok: true, redirect }, { headers: { 'cache-control': 'no-store' } })
  response.cookies.set(name, '', { ...sessionCookieOptions(0), maxAge: 0 })
  return response
}
