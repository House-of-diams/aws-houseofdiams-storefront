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
 * line, so the key is built from normalised choices only: case and spacing do not matter, and the metal is identified
 * by what the customer sees (the variant id is only used when no metal label is known). A love letter is NOT part of
 * the identity: it belongs to the line and can be added or changed later without creating a second line.
 */
export function buildCartItemKey(product: { dbId?: string | null; id?: string | number | null; slug?: string | null }, selection: CartItemSelection) {
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
  })
}

/** Folds lines that now share an identity (for example carts saved before the key was normalised) into one line. */
export function mergeDuplicateCartItems<T extends StoredCartItem>(items: T[], clamp: (quantity: number) => number): T[] {
  const merged = new Map<string, T>()
  for (const item of items) {
    const identity = item.snapshot ? { dbId: item.snapshot.dbId, id: item.snapshot.id, slug: item.snapshot.slug } : { slug: item.productSlug, id: item.productKey }
    const key = buildCartItemKey(identity, item.selection ?? {})
    const existing = merged.get(key)
    if (existing) {
      const letter = existing.selection?.loveLetter?.wantsLetter ? existing.selection.loveLetter : item.selection?.loveLetter?.wantsLetter ? item.selection.loveLetter : null
      merged.set(key, { ...existing, quantity: clamp(existing.quantity + item.quantity), selection: { ...existing.selection, loveLetter: letter } })
    } else merged.set(key, { ...item, key })
  }
  return [...merged.values()]
}

/** The line's love letter, or null when it has none ("no letter" drafts do not count). */
export function lineLetter(item: { selection?: CartItemSelection | null }): LoveLetterDraft | null {
  const letter = item.selection?.loveLetter
  return letter?.wantsLetter ? letter : null
}

/** An order carries a single letter, so at most one line of the cart has one. */
export function orderLetterLine<T extends StoredCartItem>(items: T[]): T | null {
  return items.find((item) => lineLetter(item)) ?? null
}

/** A line can get a letter (or edit its own) unless a different line already carries the order's letter. */
export function canAddLetterToLine<T extends StoredCartItem>(items: T[], key: string): boolean {
  const carrier = orderLetterLine(items)
  return !carrier || carrier.key === key
}

/** Adds, replaces (draft) or removes (null) the letter on one line. The line keeps its identity and its place. */
export function setLineLetter<T extends StoredCartItem>(items: T[], key: string, draft: LoveLetterDraft | null): T[] {
  const letter = draft?.wantsLetter ? draft : null
  if (letter && !canAddLetterToLine(items, key)) return items
  return items.map((item) => (item.key === key ? { ...item, selection: { ...item.selection, loveLetter: letter } } : item))
}

/**
 * Adds one piece to the cart. The same product with the same choices raises the quantity of its line (never a second
 * line); a letter that comes with the add is attached to that line when it has none, and an existing letter is kept.
 * A new line that brings a letter while another line already carries the order's letter is added without it.
 */
export function addToCartLines<T extends StoredCartItem>(items: T[], entry: Omit<T, 'quantity'> & { quantity?: number }, clamp: (quantity: number) => number): T[] {
  const existing = items.find((item) => item.key === entry.key)
  const incoming = lineLetter(entry as unknown as { selection?: CartItemSelection })
  if (existing) {
    const attach = incoming && !lineLetter(existing) && canAddLetterToLine(items, existing.key) ? incoming : lineLetter(existing)
    return items.map((item) => (item.key === entry.key
      ? { ...item, quantity: clamp(item.quantity + 1), snapshot: entry.snapshot ?? item.snapshot, selection: { ...item.selection, loveLetter: attach } }
      : item))
  }
  const keepLetter = incoming && !orderLetterLine(items) ? incoming : null
  return [...items, { ...entry, quantity: clamp(1), selection: { ...entry.selection, loveLetter: keepLetter } } as T]
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
