import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (name) => readFileSync(new URL(`../docs/${name}`, import.meta.url), 'utf8')
const forward = read('aws-f2-master-forward.sql')
const rollback = read('aws-f2-master-rollback.sql')
const verify = read('aws-f2-master-verify.sql')
const review = read('aws-f2-master-rls-review.md')

test('master covers all remaining F2 tables and excludes F7-only relations', () => {
  const manifest = JSON.parse(forward.match(/\$f2_expected\$(.*?)\$f2_expected\$/s)?.[1] ?? 'null')
  assert.ok(Array.isArray(manifest))
  assert.equal(new Set(manifest.map((row) => row[0])).size, 71)
  assert.equal((review.match(/^\| `[a-z0-9_]+` \|/gm) ?? []).length, 91)
  assert.doesNotMatch(forward, /\bpublic\.(?:categories|order_status_history)\b/)
  assert.match(forward, /'catalog_categories'/)
  assert.match(forward, /'catalog_subcategories'/)
  assert.match(forward, /'catalog_options'/)
  for (const table of [
    'diamond_info_config', 'diamond_info_feature_items',
    'hiphop_hero_content', 'hiphop_hero_slider_items',
    'testimonial_marquee', 'testimonial_marquee_items',
  ]) {
    assert.doesNotMatch(forward, new RegExp(`^CREATE POLICY .* ON public\\.${table} `, 'm'))
    assert.doesNotMatch(rollback, new RegExp(`^DROP POLICY .* ON public\\.${table};`, 'm'))
    assert.doesNotMatch(verify, new RegExp(`FROM public\\.${table}\\b`))
  }
})

test('every forward policy change has a matching rollback', () => {
  const created = [...forward.matchAll(/^CREATE POLICY (\S+) ON public\.(\S+) /gm)]
  const altered = [...forward.matchAll(/^ALTER POLICY ("[^"]+") ON public\.(\S+) TO (.+);$/gm)]
  assert.equal(created.length, 24)
  assert.equal(altered.length, 65)
  for (const [, policy, table] of created) {
    assert.ok(rollback.includes(`DROP POLICY "${policy}" ON public.${table};`))
  }
  for (const [, policy, table, roles] of altered) {
    const originalRoles = roles === 'authenticated' ? 'PUBLIC' : 'anon, authenticated'
    assert.ok(rollback.includes(`ALTER POLICY ${policy} ON public.${table} TO ${originalRoles};`))
  }
})

test('migration is RLS-only and verification remains read-only', () => {
  assert.match(forward, /BEGIN;/)
  assert.match(forward, /F2 policy state differs from reviewed export\/F2-A result/)
  assert.doesNotMatch(forward, /^\s*(?:GRANT|REVOKE|INSERT|UPDATE|DELETE|TRUNCATE|ALTER TABLE|DROP TABLE)\b/gm)
  assert.doesNotMatch(forward, /BYPASSRLS\s*;|DISABLE ROW LEVEL SECURITY\s*;/)
  assert.match(verify, /BEGIN READ ONLY;/)
  assert.match(verify, /ROLLBACK;/)
  assert.doesNotMatch(verify, /^\s*(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT)\b/gm)
})
