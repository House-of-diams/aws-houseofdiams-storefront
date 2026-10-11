import assert from 'node:assert/strict'

const base = process.env.F2_RDS_TEST_BASE_URL || 'http://localhost:3002'
const response = await fetch(`${base}/api/public/additional-summary-details`, { signal: AbortSignal.timeout(30_000) })
assert.equal(response.status, 200, `Summary API: HTTP ${response.status}`)
const body = await response.json()
assert.ok(Object.hasOwn(body, 'summary'), 'Summary API response shape differs')
if (body.summary) {
  assert.equal(typeof body.summary.heading, 'string')
  assert.ok(Array.isArray(body.summary.pointers))
}
console.log('Summary RDS response passed.')
