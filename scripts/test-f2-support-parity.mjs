import assert from 'node:assert/strict'

const rdsBase = process.env.F2_RDS_TEST_BASE_URL || 'http://localhost:3003'
const supabaseBase = process.env.F2_SUPABASE_TEST_BASE_URL || 'http://localhost:3002'

async function read(base, path) {
  const response = await fetch(`${base}${path}`)
  assert.equal(response.status, 200, `${base}${path}: HTTP ${response.status}`)
  return response.text()
}

function mainText(html) {
  const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] ?? ''
  return main.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
}

for (const path of ['/faq', '/returns']) {
  const [rds, supabase] = await Promise.all([read(rdsBase, path), read(supabaseBase, path)])
  assert.equal(mainText(rds), mainText(supabase), `${path} content differs`)
  console.log(`${path} rendered-text parity passed.`)
}

const [rdsSettings, supabaseSettings] = await Promise.all([
  read(rdsBase, '/api/public/settings'), read(supabaseBase, '/api/public/settings'),
])
assert.deepEqual(JSON.parse(rdsSettings), JSON.parse(supabaseSettings), 'Public settings response differs')
console.log('Public settings response parity passed.')
