import assert from 'node:assert/strict'
import test from 'node:test'
const { fillImageAlts } = await import('../lib/product-alt.ts')

test('a missing or blank alt text becomes the product name, with the view number after the first picture', () => {
  assert.deepEqual(fillImageAlts('Oval Ring', ['a', 'b', 'c'], [undefined, null, '   ']), ['Oval Ring', 'Oval Ring - view 2', 'Oval Ring - view 3'])
  assert.deepEqual(fillImageAlts('Oval Ring', ['a', 'b'], []), ['Oval Ring', 'Oval Ring - view 2'])
  assert.deepEqual(fillImageAlts('Oval Ring', ['a', 'b'], undefined), ['Oval Ring', 'Oval Ring - view 2'])
})

test('alt text an editor wrote is kept, trimmed', () => {
  assert.deepEqual(fillImageAlts('Oval Ring', ['a', 'b'], ['  Oval ring on a hand  ', 'Side view']), ['Oval ring on a hand', 'Side view'])
  assert.deepEqual(fillImageAlts('Oval Ring', ['a', 'b'], ['Front', '']), ['Front', 'Oval Ring - view 2'])
})

test('the result always matches the number of pictures; odd values and names are handled', () => {
  assert.deepEqual(fillImageAlts('X', [], ['stray']), [])
  assert.equal(fillImageAlts('X', ['a'], ['one', 'two', 'three']).length, 1)
  assert.deepEqual(fillImageAlts('  Padded Name ', ['a', 'b'], [42, {}]), ['Padded Name', 'Padded Name - view 2'])
  assert.deepEqual(fillImageAlts('', ['a'], []), ['Jewelry'], 'an empty product name still gives a usable label')
})
