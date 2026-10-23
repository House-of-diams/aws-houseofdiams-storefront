import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCartItemKey, mergeDuplicateCartItems } from '../lib/product-keys.ts'

const product = { dbId: 'p1', slug: 'luminelle-bracelet' }
const base = { metal: '10K Yellow Gold', purity: '10K', gemstone: 'Lab Grown Diamond', shape: 'marquise' }

test('the same visible choices give the same line, regardless of spacing, case or an unused love letter', () => {
  const a = buildCartItemKey(product, base)
  assert.equal(buildCartItemKey(product, { ...base, metal: ' 10k yellow gold ' }), a)
  assert.equal(buildCartItemKey(product, { ...base, metalVariantId: 'v1', loveLetter: { wantsLetter: false, letterType: 'no_letter' } }), a)
  assert.equal(buildCartItemKey(product, { ...base, resolvedPrice: 1355, resolvedImageUrl: 'x' }), a)
})

test('different choices stay separate lines', () => {
  const a = buildCartItemKey(product, base)
  assert.notEqual(buildCartItemKey(product, { ...base, metal: '14K White Gold' }), a)
  assert.notEqual(buildCartItemKey(product, { ...base, shape: 'round' }), a)
  assert.notEqual(buildCartItemKey({ dbId: 'p2' }, base), a)
  assert.notEqual(buildCartItemKey(product, { ...base, loveLetter: { wantsLetter: true, letterType: 'custom', customLetterText: 'hello' } }), a)
})

test('a saved cart with duplicate lines is folded into one line with the summed quantity', () => {
  const line = (quantity, extra = {}) => ({ key: 'old' + quantity, productKey: 'p1', productSlug: 'luminelle-bracelet', quantity, selection: { ...base, ...extra }, addedAt: 1, snapshot: { id: 'p1', dbId: 'p1', slug: 'luminelle-bracelet', name: 'B', shortMeta: '', imageUrl: '', priceFrom: 1355 } })
  const merged = mergeDuplicateCartItems([line(1), line(4, { metalVariantId: 'v1' })], (q) => Math.min(10, q))
  assert.equal(merged.length, 1); assert.equal(merged[0].quantity, 5)
  assert.equal(mergeDuplicateCartItems([line(8), line(7)], (q) => Math.min(10, q))[0].quantity, 10)
})
