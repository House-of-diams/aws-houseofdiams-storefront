import type { StorefrontProduct } from '@/lib/catalog-products'
import type { LoveLetterDraft } from '@/lib/love-letter'

export function getProductKey(product: { dbId?: string | null; id?: string | number | null; slug?: string | null }) {
  return product.dbId || product.slug || String(product.id ?? '')
}

export type CartItemSelection = {
  metalVariantId?: string
  metal?: string
  metalSlug?: string
  purity?: string
  resolvedPrice?: number
  resolvedImageUrl?: string
  sizeOrFit?: string
  ringSize?: string
  ringCategoryId?: string
  gemstone?: string
  shape?: string
  hiphopCarat?: string
  engravingMode?: string
  engravingText?: string
  loveLetter?: LoveLetterDraft | null
  customSelections?: { dropdownId: string; optionId: string; label?: string; optionLabel?: string }[]
}

export type StoredCartItem = {
  key: string
  productKey: string
  productSlug: string
  quantity: number
  selection: CartItemSelection
  addedAt: number
  snapshot?: CartProductSnapshot
}

export type CartProductSnapshot = {
  id: string
  dbId?: string
  slug: string
  name: string
  shortMeta: string
  imageUrl: string
  priceFrom: number
  recommendation?: CartProductSnapshot
}

const norm = (value: string | null | undefined) => (value ?? '').trim().toLowerCase()

/**
 * Identity of a cart line. Two additions of the same product with the same visible choices must land on the same
 * line, so the key is built from normalised choices only: case and spacing do not matter, an unused love letter
 * counts as no love letter, and the metal is identified by what the customer sees (the variant id is only used
 * when no metal label is known).
 */
export function buildCartItemKey(product: { dbId?: string | null; id?: string | number | null; slug?: string | null }, selection: CartItemSelection) {
  const letter = selection.loveLetter?.wantsLetter ? selection.loveLetter : null
  const metalLabel = norm(selection.metal) || norm(selection.metalSlug)
  return JSON.stringify({
    productKey: getProductKey(product),
    metal: metalLabel || norm(selection.metalVariantId),
    purity: norm(selection.purity),
    sizeOrFit: norm(selection.sizeOrFit),
    ringSize: norm(selection.ringSize),
    ringCategoryId: norm(selection.ringCategoryId),
    gemstone: norm(selection.gemstone),
    shape: norm(selection.shape),
    hiphopCarat: norm(selection.hiphopCarat),
    engravingMode: norm(selection.engravingMode),
    engravingText: (selection.engravingText ?? '').trim(),
    customSelections: [...(selection.customSelections ?? [])].sort((x, y) => x.dropdownId.localeCompare(y.dropdownId)).map(({ dropdownId, optionId }) => ({ dropdownId, optionId })),
    loveLetter: letter
      ? {
          letterType: letter.letterType || 'no_letter',
          recipientName: (letter.recipientName ?? '').trim(),
          senderName: (letter.senderName ?? '').trim(),
          occasionKey: letter.occasionKey || '',
          aboutHerText: (letter.aboutHerText ?? '').trim(),
          customLetterText: (letter.customLetterText ?? '').trim(),
          finalLetterText: (letter.finalLetterText ?? '').trim(),
        }
      : null,
  })
}

/** Folds lines that now share an identity (for example carts saved before the key was normalised) into one line. */
export function mergeDuplicateCartItems<T extends StoredCartItem>(items: T[], clamp: (quantity: number) => number): T[] {
  const merged = new Map<string, T>()
  for (const item of items) {
    const identity = item.snapshot ? { dbId: item.snapshot.dbId, id: item.snapshot.id, slug: item.snapshot.slug } : { slug: item.productSlug, id: item.productKey }
    const key = buildCartItemKey(identity, item.selection ?? {})
    const existing = merged.get(key)
    if (existing) merged.set(key, { ...existing, quantity: clamp(existing.quantity + item.quantity) })
    else merged.set(key, { ...item, key })
  }
  return [...merged.values()]
}

export function buildCheckoutHrefFromCartItem(product: StorefrontProduct, item: StoredCartItem) {
  const params = new URLSearchParams()
  params.set('slug', product.slug)
  params.set('name', product.name)
  params.set('price', String(item.selection.resolvedPrice ?? product.priceFrom))
  if (item.selection.resolvedImageUrl || product.imageUrl) params.set('image', item.selection.resolvedImageUrl || product.imageUrl || '')
  if (item.selection.metalVariantId) params.set('variant', item.selection.metalVariantId)
  if (item.selection.metal) params.set('metal', item.selection.metal)
  if (item.selection.hiphopCarat) params.set('carat', item.selection.hiphopCarat)
  if (item.selection.sizeOrFit) params.set('size', item.selection.sizeOrFit)
  if (item.selection.ringSize) params.set('ring_size', item.selection.ringSize)
  if (item.selection.gemstone) params.set('gemstone', item.selection.gemstone)
  if (item.selection.shape) params.set('shape', item.selection.shape)
  if (item.selection.customSelections?.length) params.set('custom', encodeURIComponent(JSON.stringify(item.selection.customSelections)))
  return `/checkout?${params.toString()}`
}
