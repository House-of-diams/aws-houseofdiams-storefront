import assert from 'node:assert/strict'

const rdsBase = process.env.F2_RDS_TEST_BASE_URL || 'http://localhost:3003'
const supabaseBase = process.env.F2_SUPABASE_TEST_BASE_URL || 'http://localhost:3002'

async function read(base, path) {
  const response = await fetch(`${base}${path}`)
  assert.equal(response.status, 200, `${base}${path}: HTTP ${response.status}`)
  return response.text()
}

function text(html) {
  return (html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] ?? html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()
}

function assertTextParity(left, right, path) {
  const rdsText = text(left)
  const supabaseText = text(right)
  if (rdsText !== supabaseText) {
    const position = [...rdsText].findIndex((character, index) => character !== supabaseText[index])
    console.error(`${path} first difference:`, {
      position,
      rds: rdsText.slice(Math.max(0, position - 70), position + 120),
      supabase: supabaseText.slice(Math.max(0, position - 70), position + 120),
    })
  }
  assert.ok(rdsText === supabaseText, `${path} rendered text differs`)
}

for (const root of ['/blog', '/education']) {
  const [rdsIndex, supabaseIndex] = await Promise.all([read(rdsBase, root), read(supabaseBase, root)])
  assertTextParity(rdsIndex, supabaseIndex, root)
  const slugs = [...new Set([...supabaseIndex.matchAll(new RegExp(`href="${root}/([a-z0-9-]+)"`, 'g'))].map((match) => match[1]))]
  if (slugs.length) {
    const path = `${root}/${slugs[0]}`
    const [rdsDetail, supabaseDetail] = await Promise.all([read(rdsBase, path), read(supabaseBase, path)])
    assertTextParity(rdsDetail, supabaseDetail, path)
  }
  console.log(`${root} listing and ${slugs.length ? 'one detail' : 'no detail'} parity passed.`)
}
