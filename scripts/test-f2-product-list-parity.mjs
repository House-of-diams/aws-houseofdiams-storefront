import assert from 'node:assert/strict'

const rdsBase = process.env.F2_RDS_TEST_BASE_URL || 'http://localhost:3003'
const supabaseBase = process.env.F2_SUPABASE_TEST_BASE_URL || 'http://localhost:3002'
const categories = ['fine-jewellery', 'engagement-rings', 'wedding-bands', 't-bar', 'hiphop', 'collection']
const sorts = ['best-matches', 'price-low', 'price-high', 'best-sellers']

async function load(base, params) {
  const response = await fetch(`${base}/api/public/products/category?${params}`)
  assert.equal(response.status, 200, `${base} ${params}: HTTP ${response.status}`)
  return response.json()
}

function differences(left, right, path = '$', found = []) {
  if (Object.is(left, right)) return found
  if (typeof left !== typeof right || left === null || right === null || typeof left !== 'object') {
    found.push(path)
    return found
  }
  if (Array.isArray(left) !== Array.isArray(right)) {
    found.push(path)
    return found
  }
  const keys = Object.keys(left)
  if (keys.length !== Object.keys(right).length) found.push(`${path} (key/count difference)`)
  for (const key of keys) {
    if (!Object.hasOwn(right, key)) found.push(`${path}.${key} (missing key)`)
    else differences(left[key], right[key], `${path}.${key}`, found)
  }
  return found
}

let checked = 0
const mismatches = []
for (const category of categories) {
  for (const sort of sorts) {
    const params = new URLSearchParams({ category, page: '1', sort })
    const [rds, supabase] = await Promise.all([load(rdsBase, params), load(supabaseBase, params)])
    const found = differences(rds, supabase)
    for (const path of found) {
      const productIndex = /^\$\.products\.(\d+)/.exec(path)?.[1]
      mismatches.push({
        category,
        sort,
        slug: productIndex ? rds.products[Number(productIndex)]?.slug : null,
        path,
      })
    }
    checked++
  }
}
if (mismatches.length) console.error('Product list parity differences:', mismatches.slice(0, 60), `total=${mismatches.length}`)
assert.deepEqual(mismatches, [], `${mismatches.length} product list parity differences`)
console.log(`Product list parity passed for ${checked} category/sort combinations.`)
