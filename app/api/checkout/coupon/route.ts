import { NextResponse } from 'next/server'
import { resolveAuthoritativeCheckoutPricing, type AuthoritativePricingItem } from '@/lib/checkout-pricing'
import { enforceRateLimit } from '@/lib/rate-limit'
import { findCheckoutCouponByCodeFromRds } from '@/lib/repositories/checkout-pricing-repository'

type CouponPayload = {
  code?: string
  items?: AuthoritativePricingItem[]
}

export async function POST(request: Request) {

  const rateLimit = await enforceRateLimit(request, { key: 'checkout-coupon', limit: 12, windowSeconds: 60 })
  if (!rateLimit.ok && rateLimit.response) return rateLimit.response

  const body = (await request.json().catch(() => null)) as CouponPayload | null
  const code = body?.code?.trim().toUpperCase()
  const items = body?.items ?? []

  if (!code || code.length > 64 || !/^[A-Z0-9_-]+$/.test(code) || !items.length || items.length > 50) {
    return NextResponse.json({ error: 'Invalid coupon request.' }, { status: 400 })
  }

  let coupon: Record<string, unknown> | null = null
  try {
    coupon = await findCheckoutCouponByCodeFromRds(code)
  } catch {
    return NextResponse.json({ error: 'Unable to load coupon.' }, { status: 503 })
  }

  if (!coupon || !coupon.is_active) {
    return NextResponse.json({ error: 'Coupon is invalid or inactive.' }, { status: 404 })
  }

  if (coupon.usage_limit != null && Number(coupon.usage_count ?? 0) >= Number(coupon.usage_limit)) {
    return NextResponse.json({ error: 'Coupon usage limit has been reached.' }, { status: 400 })
  }

  let pricingResult: Awaited<ReturnType<typeof resolveAuthoritativeCheckoutPricing>>
  try {
    pricingResult = await resolveAuthoritativeCheckoutPricing({
      items,
      coupon: { id: Number(coupon.id), code: String(coupon.code) },
    })
  } catch {
    return NextResponse.json({ error: 'Unable to load checkout pricing.' }, { status: 503 })
  }
  if ('error' in pricingResult) {
    return NextResponse.json({ error: pricingResult.error }, { status: pricingResult.status })
  }

  return NextResponse.json({
    coupon: {
      id: coupon.id,
      code: coupon.code,
      title: coupon.title,
      discountType: coupon.discount_type,
      discountValue: Number(coupon.discount_value || 0),
      discountAmount: pricingResult.data.couponDiscountAmount,
      rewardType: pricingResult.data.couponRewardType,
      minimumOrderAmount: Number(coupon.minimum_order_amount ?? 0),
      gift: pricingResult.data.gift,
      bannerTitle: coupon.banner_title,
      bannerDescription: coupon.banner_description,
      bannerImageUrl: coupon.gift_banner_image_url || pricingResult.data.gift?.imageUrl || '',
    },
  })
}
