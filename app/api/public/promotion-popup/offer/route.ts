import { NextResponse } from 'next/server'
import { findPromotionPopupOfferFromRds } from '@/lib/repositories/public-cms-repository'

export const dynamic = 'force-dynamic'

async function readPublicContent() {
  const promotion = await findPromotionPopupOfferFromRds()
  if (!promotion?.promotion_is_active || promotion.cta_action !== 'reveal_coupon' || promotion.selected_coupon_id == null) return NextResponse.json({ offer: null })
  const now = Date.now()
  const type = promotion.discount_type
  const amount = Number(promotion.discount_value)
  const valid = promotion.coupon_is_active && (type === 'percentage' || type === 'fixed') && Number.isFinite(amount) && amount > 0 && promotion.reward_type !== 'free_gift' &&
    (!promotion.starts_at || Date.parse(String(promotion.starts_at)) <= now) && (!promotion.ends_at || Date.parse(String(promotion.ends_at)) > now) &&
    (promotion.usage_limit == null || Number(promotion.usage_count ?? 0) < Number(promotion.usage_limit))
  if (!valid) return NextResponse.json({ offer: null })
  return NextResponse.json({ offer: { discountType: type, discountValue: amount, description: promotion.description || null, minimumOrderAmount: promotion.minimum_order_amount == null ? null : Number(promotion.minimum_order_amount) } }, { headers: { 'Cache-Control': 'no-store' } })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
