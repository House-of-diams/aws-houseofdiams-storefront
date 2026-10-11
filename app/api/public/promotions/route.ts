import { NextResponse } from 'next/server'
import { loadActiveCouponBannerRowsFromRds } from '@/lib/repositories/public-cms-repository'
import { mediaUrl } from '@/lib/media-url'
import { isF7ReadPreviewEnabled } from '@/lib/f7-read-preview'

const publicImageUrl = mediaUrl
type PublicCoupon = {
  id: string | number; code: string; title: string; reward_type: string; discount_value: number | string | null;
  minimum_order_amount: number | string | null; gift_variant_data: unknown; gift_banner_image_url: string | null;
  banner_title: string | null; banner_description: string | null; ends_at: string | null;
  usage_limit: number | null; usage_count: number | null;
  gift_product: { name: string; slug: string; sku: string | null; status: string; stock_quantity: number | null; image_1_path: string | null } | null;
}

export const dynamic = 'force-static'
export const revalidate = 300

async function readPublicContent() {
  const now = new Date().toISOString()

  const data = await loadActiveCouponBannerRowsFromRds(now) as unknown as PublicCoupon[]
  const items = (data ?? []).filter((coupon) => coupon.usage_limit == null || Number(coupon.usage_count ?? 0) < Number(coupon.usage_limit)).flatMap((coupon) => {
    const product = Array.isArray(coupon.gift_product) ? coupon.gift_product[0] : coupon.gift_product
    if (coupon.reward_type === 'free_gift' && (!product || product.status !== 'active' || (!isF7ReadPreviewEnabled() && Number(product.stock_quantity ?? 0) < 1))) return []
    const variant = coupon.gift_variant_data && typeof coupon.gift_variant_data === 'object' ? coupon.gift_variant_data as Record<string, unknown> : {}
    return [{
      id: coupon.id,
      code: coupon.code,
      title: coupon.title,
      rewardType: coupon.reward_type,
      discountValue: Number(coupon.discount_value ?? 0),
      minimumOrderAmount: Number(coupon.minimum_order_amount ?? 0),
      bannerTitle: coupon.banner_title,
      bannerDescription: coupon.banner_description,
      bannerImageUrl: publicImageUrl(coupon.gift_banner_image_url || variant.image_url || product?.image_1_path),
      gift: product ? { name: product.name, slug: product.slug, sku: product.sku, imageUrl: publicImageUrl(variant.image_url || product.image_1_path), variantLabel: variant.label || '' } : null,
      endsAt: coupon.ends_at,
    }]
  })
  return NextResponse.json({ items })
}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
