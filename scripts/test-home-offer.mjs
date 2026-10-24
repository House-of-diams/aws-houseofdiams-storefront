// Unit tests for the active home-page offer: which offers are shown, and what the button on the offers page does.
import test from 'node:test'
import assert from 'node:assert/strict'
import { couponIsUsable, OFFERS_PAGE_PATH, resolveHomeOffer } from '../lib/home-offer.ts'

const now = new Date('2026-10-24T12:00:00Z')
const media = (value) => (typeof value === 'string' && value ? `https://media.houseofdiams.com/${value}` : '')
const base = {
  id: 'o1', button_label: 'View Gift',
  home_image_path: 'offers/home.webp', home_image_alt: 'Home', promo_image_left_path: 'offers/left.webp', promo_image_left_alt: 'Left',
  promo_image_right_path: 'offers/right.webp', promo_image_right_alt: 'Right', coupon_id: null,
}
const coupon = { coupon_id: '5', code: 'GIFT', coupon_active: true, starts_at: null, ends_at: null, usage_limit: null, usage_count: 0, gift_product_id: null }
const gift = { ...coupon, gift_product_id: 'p1', gift_slug: 'pearl-studs', gift_name: 'Pearl studs', gift_status: 'active', gift_stock: 3 }

test('no active offer means nothing is shown', () => {
  assert.equal(resolveHomeOffer(null, now, media), null)
  assert.equal(OFFERS_PAGE_PATH, '/promo-codes-and-offers')
})

test('an offer with its three images and no coupon is a banner only', () => {
  const offer = resolveHomeOffer(base, now, media)
  assert.equal(offer.buttonLabel, 'View Gift'); assert.equal(offer.action, null)
  assert.deepEqual(offer.home, { url: 'https://media.houseofdiams.com/offers/home.webp', alt: 'Home' })
  assert.equal(offer.left.url.endsWith('left.webp'), true); assert.equal(offer.right.url.endsWith('right.webp'), true)
})

test('an offer missing any image is never shown', () => {
  for (const field of ['home_image_path', 'promo_image_left_path', 'promo_image_right_path']) assert.equal(resolveHomeOffer({ ...base, [field]: '' }, now, media), null, field)
  assert.equal(resolveHomeOffer({ ...base, home_image_path: 'javascript:alert(1)' }, now, (v) => (String(v).startsWith('javascript') ? '' : media(v))), null)
})

test('the button text is the admin text, falling back to View Gift', () => {
  assert.equal(resolveHomeOffer({ ...base, button_label: '  Shop the gift  ' }, now, media).buttonLabel, 'Shop the gift')
  assert.equal(resolveHomeOffer({ ...base, button_label: '   ' }, now, media).buttonLabel, 'View Gift')
})

test('a free-gift coupon links to the gift', () => {
  const offer = resolveHomeOffer({ ...base, ...gift }, now, media)
  assert.deepEqual(offer.action, { kind: 'gift', href: '/shop/pearl-studs', giftName: 'Pearl studs' })
  assert.equal(resolveHomeOffer({ ...base, ...gift, gift_slug: 'a b/../c' }, now, media).action.href, '/shop/a%20b%2F..%2Fc', 'the slug is encoded, never a path trick')
})

test('a plain coupon reveals its code', () => {
  assert.deepEqual(resolveHomeOffer({ ...base, ...coupon }, now, media).action, { kind: 'coupon', code: 'GIFT' })
  assert.equal(resolveHomeOffer({ ...base, ...coupon, code: '  ' }, now, media), null, 'a coupon without a code cannot be shown')
})

test('a dead coupon hides the whole offer', () => {
  const cases = [{ coupon_active: false }, { starts_at: '2026-10-25T00:00:00Z' }, { ends_at: '2026-10-24T12:00:00Z' }, { ends_at: '2026-10-01T00:00:00Z' }, { usage_limit: 10, usage_count: 10 }, { usage_limit: 10, usage_count: 11 }]
  for (const patch of cases) assert.equal(resolveHomeOffer({ ...base, ...coupon, ...patch }, now, media), null, JSON.stringify(patch))
  for (const patch of [{ starts_at: '2026-10-24T12:00:00Z' }, { ends_at: '2026-10-24T12:00:01Z' }, { usage_limit: 10, usage_count: 9 }, { ends_at: 'not a date' }]) assert.ok(resolveHomeOffer({ ...base, ...coupon, ...patch }, now, media), JSON.stringify(patch))
  assert.equal(couponIsUsable({ ...coupon, coupon_active: 'true' }, now), false, 'only a real boolean true counts')
})

test('a gift that is inactive, missing or out of stock hides the offer, except in the read-only preview', () => {
  for (const patch of [{ gift_status: 'draft' }, { gift_status: null }, { gift_slug: '' }, { gift_stock: 0 }, { gift_stock: null }]) assert.equal(resolveHomeOffer({ ...base, ...gift, ...patch }, now, media), null, JSON.stringify(patch))
  assert.ok(resolveHomeOffer({ ...base, ...gift, gift_stock: 0 }, now, media, false), 'preview does not require stock')
  assert.equal(resolveHomeOffer({ ...base, ...gift, gift_status: 'draft' }, now, media, false), null, 'preview still requires an active gift')
})
