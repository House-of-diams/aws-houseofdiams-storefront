import { NextResponse } from 'next/server'
import { getCustomerAuthConfig } from '@/lib/customer-auth/config'
import { resolveF7CheckoutOwner } from '@/lib/f7-checkout-owner'
import { loadCheckoutCustomerProfile } from '@/lib/repositories/checkout-profile-repository'

export async function GET(request: Request) {
  if (!getCustomerAuthConfig()) return NextResponse.json({ error: 'Customer authentication is disabled.' }, { status: 404 })
  try {
    const identity = await resolveF7CheckoutOwner(request)
    if (identity?.kind !== 'customer') return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    const profile = await loadCheckoutCustomerProfile(identity.id)
    return NextResponse.json({
      profile: {
        email: identity.email,
        first_name: profile?.first_name || '', last_name: profile?.last_name || '',
        phone: profile?.phone || '', birth_date: profile?.birth_date || '',
        anniversary_date: profile?.anniversary_date || '', country: profile?.country || '',
        state: profile?.state || '', district: profile?.district || '',
        city: profile?.city || '', postal_code: profile?.postal_code || '',
        address_line_1: profile?.address_line_1 || '', address_line_2: profile?.address_line_2 || '',
      }
    }, { headers: { 'cache-control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to load checkout profile.' }, { status: 503 })
  }
}
