import { NextResponse } from 'next/server'
import { resolveAuthoritativeCheckoutPricing } from '@/lib/checkout-pricing'
import { buildCheckoutChargeQuote } from '@/lib/exchange-rates'
import { enforceRateLimit } from '@/lib/rate-limit'

type QuotePayload = {
  country?: string | null
  currencyCode?: string | null
  items?: Array<{
    slug: string
    name?: string
    metalVariantId?: string
    metal?: string
    purity?: string
    quantity: number
  }>
  coupon?: { id?: number; code?: string } | null
}

export async function POST(request: Request) {

  const rateLimit = await enforceRateLimit(request, { key: 'checkout-quote', limit: 30, windowSeconds: 60 })
  if (!rateLimit.ok && rateLimit.response) return rateLimit.response

  const payload = (await request.json().catch(() => null)) as QuotePayload | null
  const items = payload?.items ?? []

  if (!items.length || items.length > 50) {
    return NextResponse.json({ error: 'Missing checkout items.' }, { status: 400 })
  }

  let pricingResult: Awaited<ReturnType<typeof resolveAuthoritativeCheckoutPricing>>
  try {
    pricingResult = await resolveAuthoritativeCheckoutPricing({
      items,
      coupon: payload?.coupon,
    })
  } catch {
    return NextResponse.json({ error: 'Unable to load checkout pricing.' }, { status: 503 })
  }
  if ('error' in pricingResult) {
    return NextResponse.json({ error: pricingResult.error }, { status: pricingResult.status })
  }
  const pricing = pricingResult.data
  let quote: Awaited<ReturnType<typeof buildCheckoutChargeQuote>>
  try {
    quote = await buildCheckoutChargeQuote({
      subtotalUsd: pricing.subtotalAmount,
      gstUsd: pricing.gstAmount,
      couponDiscountUsd: pricing.couponDiscountAmount,
      country: payload?.country || null,
      currencyCode: payload?.currencyCode || null,
    })
  } catch {
    return NextResponse.json({ error: 'Live exchange pricing is temporarily unavailable. Please try again shortly.' }, { status: 503 })
  }

  return NextResponse.json({
    quote,
    pricing: {
      subtotalAmount: pricing.subtotalAmount,
      gstAmount: pricing.gstAmount,
      couponDiscountAmount: pricing.couponDiscountAmount,
      totalAmount: pricing.totalAmount,
      lines: pricing.lines.map((line) => ({ slug: line.product.slug, unitPrice: line.unitPrice, quantity: line.quantity })),
      gift: pricing.gift,
    },
  })
}
