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
  // Keep placement closed in identity-only preview. Both flags must be on;
  // the route handler independently enforces the same write gate.
  if (pathname === '/api/checkout/place') {
    if (process.env.HOD_CUSTOMER_AUTH_ENABLED !== 'true' || process.env.HOD_F7_RDS_WRITE_PREPARED !== 'true') {
      return NextResponse.json({ error: 'Checkout is temporarily unavailable.' }, { status: 503, headers: { 'cache-control': 'no-store' } })
    }
    return NextResponse.next()
  }
  // The legacy direct-order endpoint must never bypass the checkout flow.
  if (pathname === '/api/create-order') return NextResponse.next()
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
    const redirectResponse = NextResponse.redirect(target, decision.status)
    // Slug redirects can be undone in the admin: a browser must not remember one forever (a cached 301 caused a redirect loop after a slug was restored).
    redirectResponse.headers.set('cache-control', 'public, max-age=60')
    return addDetectedCurrency(request, redirectResponse)
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
