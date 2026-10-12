import { NextResponse } from 'next/server'
import { findPromotionPopupOfferFromRds } from '@/lib/repositories/public-cms-repository'
import { cachePublicRead, publicCacheHeaders, PUBLIC_CACHE_SHORT_SECONDS } from '@/lib/public-cache'

export const dynamic = 'force-dynamic'

// Only the database row is cached; the date and usage checks below still run
// on every request. Checkout re-validates the coupon authoritatively.
const readPromotionOffer = cachePublicRead('promotion-popup-offer', async () => (await findPromotionPopupOfferFromRds()) ?? null, PUBLIC_CACHE_SHORT_SECONDS)

async function readPublicContent() {
  const headers = publicCacheHeaders(PUBLIC_CACHE_SHORT_SECONDS)
  const promotion = await readPromotionOffer()
  if (!promotion?.promotion_is_active || promotion.cta_action !== 'reveal_coupon' || promotion.selected_coupon_id == null) return NextResponse.json({ offer: null }, { headers })
  const now = Date.now()
  const type = promotion.discount_type
  const amount = Number(promotion.discount_value)
  const valid = promotion.coupon_is_active && (type === 'percentage' || type === 'fixed') && Number.isFinite(amount) && amount > 0 && promotion.reward_type !== 'free_gift' &&
    (!promotion.starts_at || Date.parse(String(promotion.starts_at)) <= now) && (!promotion.ends_at || Date.parse(String(promotion.ends_at)) > now) &&
    (promotion.usage_limit == null || Number(promotion.usage_count ?? 0) < Number(promotion.usage_limit))
  if (!valid) return NextResponse.json({ offer: null }, { headers })
  return NextResponse.json({ offer: { discountType: type, discountValue: amount, description: promotion.description || null, minimumOrderAmount: promotion.minimum_order_amount == null ? null : Number(promotion.minimum_order_amount) } }, { headers })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
