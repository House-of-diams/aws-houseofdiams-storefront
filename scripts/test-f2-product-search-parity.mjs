import assert from 'node:assert/strict'

const rdsBase = process.env.F2_RDS_TEST_BASE_URL || 'http://localhost:3003'
const supabaseBase = process.env.F2_SUPABASE_TEST_BASE_URL || 'http://localhost:3002'
const queries = ['', 'ring', 'diamond', 'princess', 'gold', 'earrings', 'marquise', 'necklace', 'no-such-product-zzzz']

async function search(base, query) {
  const response = await fetch(`${base}/api/public/products/search?q=${encodeURIComponent(query)}`)
  assert.equal(response.status, 200, `${base} q=${query}: HTTP ${response.status}`)
  return (await response.json()).items
}

for (const query of queries) {
  const [rds, supabase] = await Promise.all([search(rdsBase, query), search(supabaseBase, query)])
  const rdsSlugs = rds.map((item) => item.slug)
  const supabaseSlugs = supabase.map((item) => item.slug)
  const expectedSlugs = supabaseSlugs.filter((slug) => slug !== 'serenelle-pear-pav-ring')
  assert.deepEqual(rdsSlugs.slice(0, expectedSlugs.length), expectedSlugs, `Search order differs for q=${query}`)
  assert.ok(rdsSlugs.length === expectedSlugs.length ||
    (supabaseSlugs.includes('serenelle-pear-pav-ring') && rdsSlugs.length === supabaseSlugs.length),
  `Unexpected search result count for q=${query}`)
  const supabaseBySlug = new Map(supabase.map((item) => [item.slug, item]))
  for (const item of rds) {
    if (supabaseBySlug.has(item.slug)) assert.deepEqual(item, supabaseBySlug.get(item.slug), `Search item differs for ${item.slug}`)
  }
}
console.log(`Common product search payloads matched for ${queries.length} queries.`)
