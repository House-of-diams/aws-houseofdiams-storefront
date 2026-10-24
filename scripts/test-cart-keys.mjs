import test from 'node:test'
import assert from 'node:assert/strict'
import { addToCartLines, buildCartItemKey, canAddLetterToLine, mergeDuplicateCartItems, orderLetterLine, setLineLetter } from '../lib/product-keys.ts'

const product = { dbId: 'p1', slug: 'luminelle-bracelet' }
const base = { metal: '10K Yellow Gold', purity: '10K', gemstone: 'Lab Grown Diamond', shape: 'marquise' }

test('the same visible choices give the same line, regardless of spacing, case or any love letter', () => {
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
})

test('a saved cart with duplicate lines is folded into one line with the summed quantity', () => {
  const line = (quantity, extra = {}) => ({ key: 'old' + quantity, productKey: 'p1', productSlug: 'luminelle-bracelet', quantity, selection: { ...base, ...extra }, addedAt: 1, snapshot: { id: 'p1', dbId: 'p1', slug: 'luminelle-bracelet', name: 'B', shortMeta: '', imageUrl: '', priceFrom: 1355 } })
  const merged = mergeDuplicateCartItems([line(1), line(4, { metalVariantId: 'v1' })], (q) => Math.min(10, q))
  assert.equal(merged.length, 1); assert.equal(merged[0].quantity, 5)
  assert.equal(mergeDuplicateCartItems([line(8), line(7)], (q) => Math.min(10, q))[0].quantity, 10)
})

const letter = (name = 'Asha') => ({ wantsLetter: true, letterType: 'write_myself', recipientName: name, customLetterText: 'hello' })
const snap = (slug) => ({ id: slug, slug, name: slug, shortMeta: '', imageUrl: '', priceFrom: 100 })
const entry = (slug, selection = base) => ({ key: buildCartItemKey({ slug, dbId: slug }, selection), productKey: slug, productSlug: slug, selection, addedAt: 1, snapshot: snap(slug) })
const clamp = (q) => Math.min(10, Math.max(0, q))

test('adding the same product again raises the quantity and never creates a second line', () => {
  let lines = addToCartLines([], entry('ring'), clamp)
  lines = addToCartLines(lines, entry('ring'), clamp)
  lines = addToCartLines(lines, entry('ring', { ...base, loveLetter: { wantsLetter: false, letterType: 'no_letter' } }), clamp)
  assert.equal(lines.length, 1); assert.equal(lines[0].quantity, 3)
  assert.equal(addToCartLines(lines, entry('ring'), (q) => Math.min(3, q))[0].quantity, 3, 'the limit holds')
  assert.equal(addToCartLines(lines, entry('ring', { ...base, shape: 'round' }), clamp).length, 2, 'a different choice is a different line')
})

test('adding again with a letter attaches the letter to the existing line instead of a new line', () => {
  let lines = addToCartLines([], entry('ring'), clamp)
  lines = addToCartLines(lines, entry('ring', { ...base, loveLetter: letter() }), clamp)
  assert.equal(lines.length, 1); assert.equal(lines[0].quantity, 2); assert.equal(lines[0].selection.loveLetter.recipientName, 'Asha')
  lines = addToCartLines(lines, entry('ring', { ...base, loveLetter: letter('Someone else') }), clamp)
  assert.equal(lines[0].selection.loveLetter.recipientName, 'Asha', 'an existing letter is never overwritten by an add')
})

test('a cart carries one letter: a second lettered line is added without its letter', () => {
  let lines = addToCartLines([], entry('ring', { ...base, loveLetter: letter('Asha') }), clamp)
  lines = addToCartLines(lines, entry('pendant', { ...base, loveLetter: letter('Meera') }), clamp)
  assert.equal(lines.length, 2); assert.equal(orderLetterLine(lines).productSlug, 'ring')
  assert.equal(lines[1].selection.loveLetter ?? null, null)
})

test('letters can be added, replaced and removed on a line afterwards', () => {
  let lines = [entry('ring'), entry('pendant')]
  assert.equal(canAddLetterToLine(lines, lines[0].key), true)
  lines = setLineLetter(lines, lines[0].key, letter('Asha'))
  assert.equal(orderLetterLine(lines).productSlug, 'ring')
  assert.equal(canAddLetterToLine(lines, lines[1].key), false, 'only one letter per order')
  assert.equal(canAddLetterToLine(lines, lines[0].key), true, 'the lettered line itself can be edited')
  lines = setLineLetter(lines, lines[0].key, letter('Meera'))
  assert.equal(lines[0].selection.loveLetter.recipientName, 'Meera'); assert.equal(lines[0].key, entry('ring').key, 'the line keeps its identity')
  lines = setLineLetter(lines, lines[0].key, null)
  assert.equal(orderLetterLine(lines), null); assert.equal(canAddLetterToLine(lines, lines[1].key), true)
  assert.equal(setLineLetter(lines, 'missing', letter()).length, 2, 'an unknown line changes nothing')
  assert.equal(setLineLetter(lines, lines[0].key, { wantsLetter: false, letterType: 'no_letter' })[0].selection.loveLetter ?? null, null, 'a "no letter" draft is not a letter')
})

test('a saved cart where the same product has a letter on one copy folds into one line and keeps the letter', () => {
  const merged = mergeDuplicateCartItems([{ ...entry('ring'), quantity: 1 }, { ...entry('ring', { ...base, loveLetter: letter('Asha') }), quantity: 2 }], clamp)
  assert.equal(merged.length, 1); assert.equal(merged[0].quantity, 3); assert.equal(merged[0].selection.loveLetter.recipientName, 'Asha')
})
