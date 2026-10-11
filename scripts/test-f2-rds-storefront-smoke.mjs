import assert from 'node:assert/strict'

const base = process.env.F2_RDS_TEST_BASE_URL || 'http://localhost:3002'

async function get(path, expectedStatus = 200) {
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(90_000) })
  assert.equal(response.status, expectedStatus, `${path}: HTTP ${response.status}`)
  return response
}

for (const category of ['fine-jewellery', 'engagement-rings', 'wedding-bands', 't-bar', 'hiphop', 'collection']) {
  const response = await get(`/api/public/products/category?category=${category}&page=1&sort=best-matches`)
  const page = await response.json()
  assert.ok(Number.isInteger(page.totalCount) && page.totalCount >= 0, `${category}: invalid count`)
  assert.ok(Array.isArray(page.products) && page.products.length <= 24, `${category}: invalid page`)
  assert.equal(new Set(page.products.map((item) => item.dbId)).size, page.products.length, `${category}: duplicate product`)
  console.log(`${category}: ${page.totalCount} products, first page ${page.products.length}.`)
}

const search = await (await get('/api/public/products/search?q=ring')).json()
assert.ok(Array.isArray(search.items))
assert.equal(new Set(search.items.map((item) => item.slug)).size, search.items.length)
console.log(`Search: ${search.items.length} unique results.`)

const hydrationResponse = await fetch(`${base}/api/public/products`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ keys: ['princess-halo-stud-earrings', 'rosette-five-flower-bracelet'] }),
  signal: AbortSignal.timeout(90_000),
})
assert.equal(hydrationResponse.status, 200)
const hydration = await hydrationResponse.json()
assert.equal(hydration.items.length, 2)
console.log('Product hydration: 2 items.')

await get('/shop/princess-halo-stud-earrings')
await get('/bespoke')
await get('/')
const sitemap = await (await get('/sitemap.xml')).text()
assert.ok(sitemap.includes('/shop/princess-halo-stud-earrings'))
assert.ok(!sitemap.includes('/shop/serenelle-pear-pav-ring'))
console.log('Product detail, bespoke, homepage, and RDS sitemap passed.')
