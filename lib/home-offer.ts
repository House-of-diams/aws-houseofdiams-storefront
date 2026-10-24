// The active home-page offer: one image and a button on the home page, and the Promo Codes & Offers page it opens.
// Pure rules only. The database row is read in lib/repositories/public-cms-repository.ts.
export const OFFERS_PAGE_PATH = '/promo-codes-and-offers'

export type HomeOfferImage = { url: string; alt: string }
export type HomeOfferAction =
  | { kind: 'gift'; href: string; giftName: string }
  | { kind: 'coupon'; code: string }
  | null
export type HomeOffer = {
  id: string
  buttonLabel: string
  home: HomeOfferImage
  left: HomeOfferImage
  right: HomeOfferImage
  action: HomeOfferAction
}

export type HomeOfferRow = {
  id?: unknown; button_label?: unknown
  home_image_path?: unknown; home_image_alt?: unknown
  promo_image_left_path?: unknown; promo_image_left_alt?: unknown
  promo_image_right_path?: unknown; promo_image_right_alt?: unknown
  coupon_id?: unknown; code?: unknown; coupon_active?: unknown; starts_at?: unknown; ends_at?: unknown
  usage_limit?: unknown; usage_count?: unknown
  gift_product_id?: unknown; gift_slug?: unknown; gift_name?: unknown; gift_status?: unknown; gift_stock?: unknown
} | null

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const moment = (value: unknown) => {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string' && value) { const parsed = Date.parse(value); return Number.isNaN(parsed) ? null : parsed }
  return null
}

/** A coupon that can no longer be used makes the whole offer disappear, so visitors never see a dead offer. */
export function couponIsUsable(row: NonNullable<HomeOfferRow>, now: Date): boolean {
  if (row.coupon_active !== true) return false
  const start = moment(row.starts_at), end = moment(row.ends_at)
  if (start !== null && start > now.getTime()) return false
  if (end !== null && end <= now.getTime()) return false
  if (row.usage_limit != null && Number(row.usage_count ?? 0) >= Number(row.usage_limit)) return false
  return true
}

/**
 * Turns the active offer row into what the pages show, or null when nothing should be shown.
 * `mediaUrl` resolves stored image paths; `requireGiftStock` is false only in the read-only preview environment.
 */
export function resolveHomeOffer(row: HomeOfferRow, now: Date, mediaUrl: (value: unknown) => string, requireGiftStock = true): HomeOffer | null {
  if (!row) return null
  const image = (path: unknown, alt: unknown): HomeOfferImage | null => {
    const url = mediaUrl(path)
    return url ? { url, alt: text(alt) } : null
  }
  const home = image(row.home_image_path, row.home_image_alt)
  const left = image(row.promo_image_left_path, row.promo_image_left_alt)
  const right = image(row.promo_image_right_path, row.promo_image_right_alt)
  if (!home || !left || !right) return null

  let action: HomeOfferAction = null
  if (row.coupon_id != null) {
    if (!couponIsUsable(row, now)) return null
    if (row.gift_product_id != null) {
      const slug = text(row.gift_slug)
      if (!slug || row.gift_status !== 'active' || (requireGiftStock && Number(row.gift_stock ?? 0) < 1)) return null
      action = { kind: 'gift', href: `/shop/${encodeURIComponent(slug)}`, giftName: text(row.gift_name) }
    } else if (text(row.code)) {
      action = { kind: 'coupon', code: text(row.code) }
    } else {
      return null
    }
  }
  return { id: String(row.id ?? ''), buttonLabel: text(row.button_label) || 'View Gift', home, left, right, action }
}
