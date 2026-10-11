import { NextResponse } from 'next/server'
import { getCustomerAuthConfig } from '@/lib/customer-auth/config'
import { customerAuthCookieNames, getCustomerSession } from '@/lib/customer-auth/oidc'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (!getCustomerAuthConfig()) return NextResponse.json({ error: 'Customer authentication is disabled.' }, { status: 404 })
  const name = customerAuthCookieNames().session
  const bearer = (request.headers.get('cookie') || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1)
  try {
    const identity = await getCustomerSession(bearer)
    return NextResponse.json({ authenticated: Boolean(identity), identity: identity ? { id: identity.id, email: identity.email, emailVerified: identity.email_verified } : null }, { headers: { 'cache-control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Customer session storage is not ready.' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
}
