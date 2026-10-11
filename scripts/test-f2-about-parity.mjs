import assert from 'node:assert/strict'

const rdsBase = process.env.F2_RDS_TEST_BASE_URL || 'http://localhost:3003'
const supabaseBase = process.env.F2_SUPABASE_TEST_BASE_URL || 'http://localhost:3002'
const paths = ['/api/public/about/hero', '/api/public/about/wide-banner', '/api/public/about/founders', '/api/public/about/timeline', '/api/public/about/values']

async function read(base, path) {
  const response = await fetch(`${base}${path}`)
  assert.equal(response.status, 200, `${base}${path}: HTTP ${response.status}`)
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

for (const path of paths) {
  const [rds, supabase] = await Promise.all([read(rdsBase, path), read(supabaseBase, path)])
  const found = differences(rds, supabase)
  if (found.length) console.error(path, found.slice(0, 30))
  assert.deepEqual(found, [], `${path}: ${found.length} differences`)
  console.log(`${path} parity passed.`)
}
