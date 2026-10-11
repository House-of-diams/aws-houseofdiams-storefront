import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Client } from 'pg'

const rdsBase = process.env.F2_RDS_TEST_BASE_URL || 'http://localhost:3001'
const supabaseBase = process.env.F2_SUPABASE_TEST_BASE_URL || 'http://localhost:3002'
const sampleKeys = ['princess-halo-stud-earrings', 'asteria-seven-stone-necklace', 'rosette-five-flower-bracelet']

async function activeRdsSlugs() {
  process.loadEnvFile('.env.local')
  const url = new URL(process.env.DATABASE_URL)
  url.hostname = process.env.DB_TLS_EXPECTED_HOST
  url.port = '5432'
  const client = new Client({
    connectionString: url.toString(),
    ssl: { ca: readFileSync(process.env.DB_CA_CERT_PATH, 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 30000,
  })
  await client.connect()
  try {
    await client.query('BEGIN READ ONLY')
    const result = await client.query("SELECT slug FROM public.products WHERE status = $1 ORDER BY slug", ['active'])
    await client.query('ROLLBACK')
    return result.rows.map(({ slug }) => slug)
  } finally {
    await client.end()
  }
}

async function load(baseUrl, requestedKeys) {
  const response = await fetch(`${baseUrl}/api/public/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys: requestedKeys }),
  })
  assert.equal(response.status, 200, `${baseUrl} returned HTTP ${response.status}`)
  return (await response.json()).items
}

function differences(left, right, path = '$', found = []) {
  if (Object.is(left, right)) return found
  if (typeof left !== typeof right || left === null || right === null) {
    found.push(path)
    return found
  }
  if (typeof left !== 'object') {
    found.push(path)
    return found
  }
  if (Array.isArray(left) !== Array.isArray(right)) {
    found.push(path)
    return found
  }
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) found.push(`${path} (key/count difference)`)
  for (const key of leftKeys) {
    if (!Object.hasOwn(right, key)) {
      found.push(`${path}.${key} (missing key)`)
      continue
    }
    differences(left[key], right[key], `${path}.${key}`, found)
  }
  return found
}

const keys = process.env.F2_PARITY_ALL_PRODUCTS === 'true' ? await activeRdsSlugs() : sampleKeys
let timestampDriftCount = 0
let checked = 0
for (let index = 0; index < keys.length; index += 50) {
  const batch = keys.slice(index, index + 50)
  const [rdsItems, supabaseItems] = await Promise.all([
    load(rdsBase, batch), load(supabaseBase, batch),
  ])
  const found = differences(rdsItems, supabaseItems)
  timestampDriftCount += found.filter((path) => path.endsWith('.updated_at')).length
  const materialDifferences = found.filter((path) => !path.endsWith('.updated_at'))
  if (materialDifferences.length) console.error(`Product batch ${index / 50 + 1} difference paths:`, materialDifferences.slice(0, 50))
  assert.deepEqual(materialDifferences, [], `${materialDifferences.length} material product response differences`)
  checked += rdsItems.length
}
console.log(`Product hydration parity passed for ${checked} requested products; ${timestampDriftCount} staging updated_at differences recorded.`)
