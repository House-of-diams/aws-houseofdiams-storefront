import 'server-only'

import { customerAuthCookieNames, getCustomerSession } from '@/lib/customer-auth/oidc'
import { getGuestCheckoutTokenHash } from '@/lib/guest-checkout'

export type F7CheckoutOwner =
  | { kind: 'customer'; id: string; email: string }
  | { kind: 'guest'; hash: string }

export async function resolveF7CheckoutOwner(request: Request): Promise<F7CheckoutOwner | null> {
  // A bearer token must never become a customer or guest identity; only the session cookie or guest token counts.
  if (request.headers.get('authorization')) return null
  const cookieName = customerAuthCookieNames().session
  const token = (request.headers.get('cookie') || '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
  if (token) {
    const identity = await getCustomerSession(token)
    return identity?.email_verified ? { kind: 'customer', id: identity.id, email: identity.email } : null
  }
  const hash = getGuestCheckoutTokenHash(request)
  return hash ? { kind: 'guest', hash } : null
}
