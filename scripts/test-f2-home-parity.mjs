import assert from 'node:assert/strict'

const rdsBase = process.env.F2_RDS_TEST_BASE_URL || 'http://localhost:3003'
const supabaseBase = process.env.F2_SUPABASE_TEST_BASE_URL || 'http://localhost:3002'

async function home(base) {
  const response = await fetch(base)
  assert.equal(response.status, 200, `${base}: HTTP ${response.status}`)
  return response.text()
}

function readable(value) {
  return value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim()
}

function headings(html) {
  return [...html.matchAll(/<h[1-3]\b[^>]*>(.*?)<\/h[1-3]>/gis)]
    .map((match) => readable(match[1])).filter(Boolean)
}

function visibleText(html) {
  return readable(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ''))
    .replace(/\s+/g, ' ')
}

const [rdsHtml, supabaseHtml] = await Promise.all([home(rdsBase), home(supabaseBase)])
const rdsHeadings = headings(rdsHtml)
const supabaseHeadings = headings(supabaseHtml)
if (JSON.stringify(rdsHeadings) !== JSON.stringify(supabaseHeadings)) {
  console.error({ rdsHeadings, supabaseHeadings })
}
assert.deepEqual(rdsHeadings, supabaseHeadings, 'Homepage visible headings differ')
const rdsText = visibleText(rdsHtml)
const supabaseText = visibleText(supabaseHtml)
if (rdsText !== supabaseText) {
  const position = [...rdsText].findIndex((character, index) => character !== supabaseText[index])
  console.error('First visible-text difference:', {
    position,
    rds: rdsText.slice(Math.max(0, position - 60), position + 100),
    supabase: supabaseText.slice(Math.max(0, position - 60), position + 100),
  })
}
assert.equal(rdsText, supabaseText, 'Homepage rendered text differs')
console.log(`Homepage rendered-text parity passed (${rdsHeadings.length} headings).`)
