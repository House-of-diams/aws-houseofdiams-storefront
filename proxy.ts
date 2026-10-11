import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { currencyForCountry, normalizeCountryCode } from '@/lib/country-currency'
import {
  decideRouting,
} from '@/lib/routing-state-logic'
import { getCachedRoutingState } from '@/lib/routing-state'

const DETECTED_CURRENCY_COOKIE = 'detected_currency'
const DETECTED_COUNTRY_COOKIE = 'detected_country'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

function addDetectedCurrency(request: NextRequest, response: NextResponse) {
  const countryCode = normalizeCountryCode(request.headers.get('cloudfront-viewer-country'))
  if (!countryCode) return response

  const detectedCurrency = currencyForCountry(countryCode)
  const cookieOptions = {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  }

  response.cookies.set({ name: DETECTED_COUNTRY_COOKIE, value: countryCode, ...cookieOptions })
  response.cookies.set({ name: DETECTED_CURRENCY_COOKIE, value: detectedCurrency, ...cookieOptions })
  return response
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  // F6 identity preview must never start orders with the legacy owner contract.
  // Existing payment verification/webhooks remain reachable for recovery.
  if (pathname === '/api/checkout/place' || pathname === '/api/create-order') {
    if (process.env.HOD_CUSTOMER_AUTH_ENABLED === 'true') {
      return NextResponse.json({ error: 'Checkout is temporarily unavailable.' }, { status: 503, headers: { 'cache-control': 'no-store' } })
    }
    return NextResponse.next()
  }
  if (pathname === '/maintenance') {
    return addDetectedCurrency(request, NextResponse.next())
  }

  const routingState = await getCachedRoutingState()
  const decision = decideRouting(routingState, pathname, request.nextUrl.search)

  if (decision.type === 'maintenance') {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = '/maintenance'
    rewriteUrl.searchParams.set('message', decision.message)
    return addDetectedCurrency(request, NextResponse.rewrite(rewriteUrl))
  }

  if (decision.type === 'redirect') {
    const target = request.nextUrl.clone()
    target.pathname = decision.pathname
    target.search = ''
    return addDetectedCurrency(request, NextResponse.redirect(target, decision.status))
  }

  if (decision.type === 'not-found') {
    return addDetectedCurrency(request, new NextResponse(null, { status: 404 }))
  }

  return addDetectedCurrency(request, NextResponse.next())
}

export const config = {
  matcher: [
    '/api/checkout/place',
    '/api/create-order',
    '/((?!api|_next/static|_next/image|favicon.ico|house-of-diams-favicon.ico|fonts|images|assets|.*\\..*).*)',
  ],
}
