import 'server-only'
import { mediaUrl } from '@/lib/media-url'
import {
  loadCheckoutProductsFromRds, loadCheckoutVariantsFromRds,
  loadCheckoutPurityPricesFromRds, loadCheckoutSettingsFromRds,
  loadCheckoutGstSlabsFromRds, loadFallbackCheckoutGstSlabFromRds,
  loadCheckoutCouponFromRds, loadCheckoutGiftProductFromRds,
  loadCheckoutGiftVariantFromRds,
} from '@/lib/repositories/checkout-pricing-repository'

function publicImageUrl(path: unknown) {
  return mediaUrl(path)
}

export type AuthoritativePricingItem = {
  slug: string
  name?: string
  metalVariantId?: string
  metal?: string
  purity?: string
  quantity: number
}

export type AuthoritativeCoupon = {
  id?: number
  code?: string
} | null

type ProductRow = {
  id: string
  slug: string
  name: string
  sku: string | null
  gst_slab_id: string | null
  base_price: number | null
  default_purity_price_id: string | null
  stock_quantity: number | null
  allow_checkout: boolean | null
  product_lane: 'standard' | 'hiphop' | 'collection' | null
  status: string | null
  custom_dropdowns_enabled: boolean | null
  image_1_path?: string | null
}

type MetalVariantRow = { id: string; product_id: string; price: number | null }
type PurityPriceRow = { id: string; product_id: string; purity_label: string | null; price: number | null; sort_order: number | null }
type GstSlabRow = { id: string; name: string; percentage: number | null }

export type AuthoritativePricingLine = {
  entry: AuthoritativePricingItem
  product: ProductRow
  quantity: number
  unitPrice: number
  subtotalAmount: number
  gstPercentage: number
  gstLabel: string
  gstAmount: number
  gstSlabId: string | null
}

export async function resolveAuthoritativeCheckoutPricing({
  items,
  coupon,
}: {
  items: AuthoritativePricingItem[]
  coupon?: AuthoritativeCoupon
}) {

  if (!items.length || items.length > 50 || items.some((item) => !item?.slug)) {
    return { error: 'Missing checkout items.', status: 400 as const }
  }

  const slugs = [...new Set(items.map((item) => item.slug))]
  const { data: productRows, error: productError } = { data: await loadCheckoutProductsFromRds(slugs), error: null as { code?: string; message: string } | null }

  if (productError) return { error: productError.message, status: 500 as const }

  const products = (productRows || []) as ProductRow[]
  const productBySlug = new Map(products.map((product) => [product.slug, product]))
  const productIds = products.map((product) => product.id)

  const [metalVariantsResult, purityPricesResult, settingsResult] = await Promise.all([
    productIds.length
      ? loadCheckoutVariantsFromRds(productIds).then((data) => ({ data, error: null as { code?: string; message: string } | null }))
      : Promise.resolve({ data: [], error: null as { code?: string; message: string } | null }),
    productIds.length
      ? loadCheckoutPurityPricesFromRds(productIds).then((data) => ({ data, error: null as { code?: string; message: string } | null }))
      : Promise.resolve({ data: [], error: null as { code?: string; message: string } | null }),
    loadCheckoutSettingsFromRds().then((data) => ({ data, error: null as { code?: string; message: string } | null })),
  ])

  if (metalVariantsResult.error) return { error: metalVariantsResult.error.message, status: 500 as const }
  if (purityPricesResult.error) return { error: purityPricesResult.error.message, status: 500 as const }
  if (settingsResult.error) return { error: settingsResult.error.message, status: 500 as const }

  const metalVariants = (metalVariantsResult.data || []) as MetalVariantRow[]
  const metalVariantById = new Map(metalVariants.map((variant) => [variant.id, variant]))
  const purityPrices = (purityPricesResult.data || []) as PurityPriceRow[]
  const defaultGstSlabId = settingsResult.data?.default_gst_slab_id ?? null
  const gstSlabIds = [...new Set([...products.map((product) => product.gst_slab_id), defaultGstSlabId].filter(Boolean))]
  const gstResult = gstSlabIds.length
    ? { data: await loadCheckoutGstSlabsFromRds(gstSlabIds as string[]), error: null as { code?: string; message: string } | null }
    : { data: [], error: null as { code?: string; message: string } | null }
  if (gstResult.error) return { error: gstResult.error.message, status: 500 as const }

  let fallbackGstSlab: GstSlabRow | null = null
  if (!(gstResult.data || []).length) {
    const fallbackResult = { data: await loadFallbackCheckoutGstSlabFromRds(), error: null as { code?: string; message: string } | null }
    if (fallbackResult.error) return { error: fallbackResult.error.message, status: 500 as const }
    fallbackGstSlab = fallbackResult.data as GstSlabRow | null
  }

  const gstSlabs = (gstResult.data || []) as GstSlabRow[]
  const gstById = new Map(gstSlabs.map((slab) => [slab.id, slab]))
  fallbackGstSlab ||= gstSlabs[0] || null
  const requestedQuantityByProduct = new Map<string, number>()
  let pricingError = ''

  let lines: AuthoritativePricingLine[] = items.map((entry) => {
    const product = productBySlug.get(entry.slug)
    const quantity = Number(entry.quantity)
    if (!product) {
      pricingError = `This product is no longer available: ${entry.slug}.`
      return null
    }
    const productLane = product.product_lane ?? 'standard'
    const checkoutAllowed = productLane === 'standard' || (productLane === 'hiphop' && product.allow_checkout === true)
    if (product.status !== 'active' || !checkoutAllowed) pricingError = `${product.name} is not available for checkout.`
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) pricingError = `Invalid quantity for ${product.name}.`
    requestedQuantityByProduct.set(product.id, (requestedQuantityByProduct.get(product.id) || 0) + quantity)

    const requestedVariant = entry.metalVariantId ? metalVariantById.get(entry.metalVariantId) || null : null
    const productHasStoredVariants = metalVariants.some((variant) => variant.product_id === product.id)
    if (entry.metalVariantId && (!requestedVariant || requestedVariant.product_id !== product.id) && (!entry.metalVariantId.startsWith('legacy-') || productHasStoredVariants)) {
      pricingError = `The selected configuration for ${product.name} is no longer available.`
    }

    const productPurityPrices = purityPrices.filter((row) => row.product_id === product.id)
    const selectionText = `${entry.purity || ''} ${entry.metal || ''}`.toLowerCase()
    const selectedPurityPrice =
      productPurityPrices.find((row) => Boolean(row.purity_label) && selectionText.includes(String(row.purity_label).toLowerCase())) ||
      productPurityPrices.find((row) => row.id === product.default_purity_price_id) ||
      productPurityPrices[0] ||
      null
    const unitPrice = Number(requestedVariant ? requestedVariant.price : selectedPurityPrice?.price ?? product.base_price ?? 0)
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) pricingError = `A valid price is not available for ${product.name}.`

    const gstSlab =
      (product.gst_slab_id ? gstById.get(product.gst_slab_id) : null) ||
      (defaultGstSlabId ? gstById.get(defaultGstSlabId) : null) ||
      fallbackGstSlab
    const subtotalAmount = Number((unitPrice * quantity).toFixed(2))
    return {
      entry,
      product,
      quantity,
      unitPrice,
      subtotalAmount,
      gstPercentage: Number(gstSlab?.percentage ?? 0),
      gstLabel: gstSlab?.name || 'Taxes',
      gstAmount: 0,
      gstSlabId: product.gst_slab_id ?? null,
    }
  }).filter(Boolean) as AuthoritativePricingLine[]

  if (pricingError) return { error: pricingError, status: 400 as const }

  const subtotalAmount = Number(lines.reduce((sum, line) => sum + line.subtotalAmount, 0).toFixed(2))
  let couponId: number | null = null
  let couponCode: string | null = null
  let couponDiscountAmount = 0
  let couponRewardType: 'percentage' | 'fixed' | 'free_gift' | null = null
  let gift: {
    productId: string
    name: string
    slug: string
    sku: string | null
    imageUrl: string
    originalUnitPrice: number
    variantData: Record<string, unknown>
  } | null = null

  if (coupon?.id && coupon?.code) {
    const { data: couponRow, error: couponError } = { data: await loadCheckoutCouponFromRds(coupon.id, coupon.code.trim().toUpperCase()), error: null as { code?: string; message: string } | null }
    if (couponError) return { error: couponError.message, status: 500 as const }
    if (!couponRow?.is_active) return { error: 'Selected coupon is no longer valid.', status: 400 as const }
    const now = Date.now()
    if (couponRow.starts_at && new Date(couponRow.starts_at).getTime() > now) return { error: 'This coupon is not active yet.', status: 400 as const }
    if (couponRow.ends_at && new Date(couponRow.ends_at).getTime() <= now) return { error: 'This coupon has expired.', status: 400 as const }
    if (couponRow.usage_limit != null && couponRow.usage_count >= couponRow.usage_limit) {
      return { error: 'Coupon usage limit has been reached.', status: 400 as const }
    }
    couponRewardType = couponRow.reward_type === 'free_gift' ? 'free_gift' : couponRow.reward_type === 'fixed' ? 'fixed' : 'percentage'
    const minimumOrderAmount = Number(couponRow.minimum_order_amount ?? 0)
    if (subtotalAmount < minimumOrderAmount) {
      return { error: `Add $${Number((minimumOrderAmount - subtotalAmount).toFixed(2))} more to use this coupon.`, status: 400 as const }
    }
    if (couponRewardType === 'free_gift') {
      if (!couponRow.gift_product_id) return { error: 'This gift offer is not configured correctly.', status: 400 as const }
      const { data: giftProduct, error: giftError } = { data: await loadCheckoutGiftProductFromRds(String(couponRow.gift_product_id)), error: null as { code?: string; message: string } | null }
      if (giftError) return { error: giftError.message, status: 500 as const }
      if (!giftProduct || giftProduct.status !== 'active') return { error: 'The complimentary gift is currently unavailable.', status: 400 as const }
      const variantData = couponRow.gift_variant_data && typeof couponRow.gift_variant_data === 'object' ? couponRow.gift_variant_data as Record<string, unknown> : {}
      const variantId = typeof variantData.variant_id === 'string' ? variantData.variant_id : null
      let originalUnitPrice = Number(variantData.price ?? giftProduct.base_price ?? 0)
      if (variantId) {
        const { data: variant } = { data: await loadCheckoutGiftVariantFromRds(variantId, String(giftProduct.id)) }
        if (!variant) return { error: 'The selected gift variant is no longer available.', status: 400 as const }
        originalUnitPrice = Number(variant.price ?? originalUnitPrice)
      }

      gift = { productId: giftProduct.id, name: giftProduct.name, slug: giftProduct.slug, sku: giftProduct.sku, imageUrl: publicImageUrl(variantData.image_url || giftProduct.image_1_path), originalUnitPrice, variantData }
    } else {
      const calculated = couponRow.discount_type === 'percentage'
        ? subtotalAmount * (Number(couponRow.discount_value || 0) / 100)
        : Number(couponRow.discount_value || 0)
      couponDiscountAmount = Math.max(0, Math.min(subtotalAmount, Number(calculated.toFixed(2))))
    }
    couponId = couponRow.id
    couponCode = couponRow.code
  }

  lines = lines.map((line) => {
    const discountShare = subtotalAmount > 0 ? couponDiscountAmount * (line.subtotalAmount / subtotalAmount) : 0
    const taxableAmount = Math.max(0, line.subtotalAmount - discountShare)
    return { ...line, gstAmount: Number((taxableAmount * (line.gstPercentage / 100)).toFixed(2)) }
  })

  const gstAmount = Number(lines.reduce((sum, line) => sum + line.gstAmount, 0).toFixed(2))
  return {
    data: {
      lines,
      subtotalAmount,
      gstAmount,
      gstLabel: lines.length === 1 ? lines[0]?.gstLabel || 'Taxes' : 'Taxes',
      gstPercentage: lines.length === 1 ? lines[0]?.gstPercentage || 0 : lines.reduce((highest, line) => Math.max(highest, line.gstPercentage), 0),
      couponId,
      couponCode,
      couponDiscountAmount,
      couponRewardType,
      gift,
      totalAmount: Number((Math.max(0, subtotalAmount - couponDiscountAmount) + gstAmount).toFixed(2)),
    },
  } as const
}
