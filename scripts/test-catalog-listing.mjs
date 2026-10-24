import assert from 'node:assert/strict'
import test from 'node:test'
const { shouldIndexListing, filterNonEmpty } = await import('../lib/catalog-listing-rules.ts')

test('an empty listing is kept out of search; a listing with products is kept in', () => {
  assert.equal(shouldIndexListing({ totalCount: 0 }), false)
  assert.equal(shouldIndexListing({ totalCount: 1 }), true)
  assert.equal(shouldIndexListing({ totalCount: 240 }), true)
})

test('an editor can still hide a page that has products', () => {
  assert.equal(shouldIndexListing({ seoIndexable: false, totalCount: 12 }), false)
  assert.equal(shouldIndexListing({ seoIndexable: true, totalCount: 12 }), true)
  assert.equal(shouldIndexListing({ seoIndexable: null, totalCount: 12 }), true)
})

test('if the product count cannot be read, the page stays indexable (never hide pages because of a database hiccup)', () => {
  assert.equal(shouldIndexListing({ totalCount: null }), true)
  assert.equal(shouldIndexListing({ totalCount: undefined }), true)
  assert.equal(shouldIndexListing({ seoIndexable: false, totalCount: null }), false)
  assert.equal(shouldIndexListing({ totalCount: Number.NaN }), true)
  assert.equal(shouldIndexListing({ totalCount: -1 }), true)
})

test('filterNonEmpty drops only the entries known to be empty and keeps the order', async () => {
  const entries = ['a', 'b', 'c', 'd']
  const counts = { a: 3, b: 0, c: null, d: 1 }
  const kept = await filterNonEmpty(entries, async (entry) => counts[entry], 2)
  assert.deepEqual(kept, ['a', 'c', 'd'])
  assert.deepEqual(await filterNonEmpty([], async () => 0, 3), [])
})

test('filterNonEmpty never runs more lookups at once than allowed and survives a lookup that throws', async () => {
  let running = 0, peak = 0
  const kept = await filterNonEmpty(Array.from({ length: 12 }, (_, i) => i), async (i) => {
    running += 1; peak = Math.max(peak, running)
    await new Promise((resolve) => setTimeout(resolve, 5))
    running -= 1
    if (i === 5) throw new Error('db down')
    return i === 7 ? 0 : 4
  }, 3)
  assert.ok(peak <= 3, `peak ${peak}`)
  assert.deepEqual(kept, [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11])
})
