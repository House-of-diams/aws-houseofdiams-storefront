import assert from 'node:assert/strict'

const rdsBase = process.env.F2_RDS_TEST_BASE_URL || 'http://localhost:3003'
const supabaseBase = process.env.F2_SUPABASE_TEST_BASE_URL || 'http://localhost:3002'
const paths = ['/about', '/bespoke', '/faq', '/returns', '/shop/princess-halo-stud-earrings']

function text(html) {
  return (html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()
}

async function read(base, path) {
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(60_000) })
  assert.equal(response.status, 200, `${base}${path}: HTTP ${response.status}`)
  return text(await response.text())
}

for (const path of paths) {
  const [rds, supabase] = await Promise.all([read(rdsBase, path), read(supabaseBase, path)])
  if (rds !== supabase) {
    const position = [...rds].findIndex((character, index) => character !== supabase[index])
    console.error(path, { position, rds: rds.slice(Math.max(0, position - 60), position + 100), supabase: supabase.slice(Math.max(0, position - 60), position + 100) })
  }
  assert.equal(rds, supabase, `${path} rendered text differs`)
  console.log(`${path} rendered-text parity passed.`)
}
