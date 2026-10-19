import 'server-only'

import { query } from '@/lib/db/query'

type JsonRow = Record<string, unknown>
type CouponRow = {
  id: number; code: string; title: string; status: string; is_active: boolean; starts_at: string | null; ends_at: string | null;
  usage_limit: number | null; usage_count: number; minimum_order_amount: number | null;
  discount_type: string; discount_value: number | null; reward_type: string | null;
  gift_product_id: string | null; gift_variant_data: Record<string, unknown> | null;
  gift_banner_image_url: string | null; banner_title: string | null; banner_description: string | null;
}
type GiftRow = { id: string; slug: string; name: string; sku: string | null; status: string; stock_quantity: number | null; base_price: number | null; image_1_path: string | null }
type GstRow = { id: string; name: string; percentage: number | null }

async function rows<T = JsonRow>(sql: string, values: readonly unknown[], operation: string): Promise<T[]> {
  const result = await query<{ row: T }>(sql, values, { operation })
  return result.rows.map(({ row }) => row)
}

export async function loadCheckoutProductsFromRds(slugs: string[]) {
  return rows('select to_jsonb(p) row from public.products p where p.slug = any($1::text[])',
    [slugs], 'checkout.pricing.products')
}

// Metal label fields and the variant's first image let checkout record what was
// priced, instead of trusting labels and images sent by the browser.
export async function loadCheckoutVariantsFromRds(productIds: string[]) {
  return rows(`select to_jsonb(v) || jsonb_build_object(
      'metal_name', m.name, 'metal_display_label', m.display_label,
      'metal_purity_label', m.purity_label, 'metal_base_name', m.base_metal_name,
      'image_path', (select i.media_path from public.product_variant_media_items i
        where i.variant_id = v.id and i.media_type = 'image' order by i.sort_order, i.id limit 1)) row
    from public.product_metal_variants v join public.catalog_metals m on m.id = v.metal_id
    where v.product_id = any($1::uuid[])`,
    [productIds], 'checkout.pricing.variants')
}

export async function loadCheckoutPurityPricesFromRds(productIds: string[]) {
  return rows('select to_jsonb(p) row from public.product_purity_prices p where p.product_id = any($1::uuid[]) order by p.sort_order asc',
    [productIds], 'checkout.pricing.purity')
}

export async function loadCheckoutSettingsFromRds() {
  const found = await rows<{ default_gst_slab_id: string | null }>('select to_jsonb(s) row from public.site_settings s where s.settings_key = $1 limit 2',
    ['global_site_settings'], 'checkout.pricing.settings')
  if (found.length > 1) throw new Error('Expected one checkout setting.')
  return found[0] ?? null
}

export async function loadCheckoutGstSlabsFromRds(ids: string[]) {
  return rows<GstRow>('select to_jsonb(s) row from public.catalog_gst_slabs s where s.id = any($1::uuid[])',
    [ids], 'checkout.pricing.gst')
}

export async function loadFallbackCheckoutGstSlabFromRds() {
  const found = await rows<GstRow>('select to_jsonb(s) row from public.catalog_gst_slabs s where s.status <> $1 order by s.display_order asc limit 1',
    ['hidden'], 'checkout.pricing.gst-fallback')
  return found[0] ?? null
}

export async function loadCheckoutCouponFromRds(id: number, code: string) {
  const found = await rows<CouponRow>('select to_jsonb(c) row from public.coupons c where c.id = $1 and c.code = $2 limit 2',
    [id, code], 'checkout.pricing.coupon')
  if (found.length > 1) throw new Error('Expected one checkout coupon.')
  return found[0] ?? null
}

// Orders still in payment with this coupon (reservation window), so a limited
// coupon is not handed out to more checkouts than it has uses left. Uses
// orders_pending_coupon_idx (db/migrations/2026101901_coupon_usage_limit).
export async function countPendingCouponOrdersFromRds(couponId: number) {
  const found = await rows<{ n: number }>(`select jsonb_build_object('n', count(*)::int) row from public.orders
    where payment_status = 'pending' and coalesce(gateway_order_status, '') <> 'checkout_dismissed'
      and created_at > now() - interval '15 minutes'
      and gateway_payload->'checkout'->'coupon'->>'id' = $1::text`,
  [String(couponId)], 'checkout.pricing.coupon-pending')
  return Number(found[0]?.n ?? 0)
}

export async function findCheckoutCouponByCodeFromRds(code: string) {
  const found = await rows<CouponRow>('select to_jsonb(c) row from public.coupons c where c.code = $1 limit 2',
    [code], 'checkout.coupon.lookup')
  if (found.length > 1) throw new Error('Expected one checkout coupon code.')
  return found[0] ?? null
}

export async function loadCheckoutGiftProductFromRds(id: string) {
  const found = await rows<GiftRow>('select to_jsonb(p) row from public.products p where p.id = $1::uuid limit 2',
    [id], 'checkout.pricing.gift')
  if (found.length > 1) throw new Error('Expected one checkout gift.')
  return found[0] ?? null
}

export async function loadCheckoutGiftVariantFromRds(id: string, productId: string) {
  const found = await rows<{ id: string; product_id: string; price: number | null }>('select to_jsonb(v) row from public.product_metal_variants v where v.id = $1::uuid and v.product_id = $2::uuid limit 2',
    [id, productId], 'checkout.pricing.gift-variant')
  if (found.length > 1) throw new Error('Expected one checkout gift variant.')
  return found[0] ?? null
}
