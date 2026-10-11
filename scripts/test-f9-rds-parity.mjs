import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createRequire } from 'node:module'
import { Client } from 'pg'
import ts from 'typescript'

// Compare a pre-cleanup local snapshot with the current source using only the
// read-only clone. No old-provider requests, writes or payment calls are allowed.
const baseline = resolve(process.argv[2] || '')
const catalogOnly = process.argv.includes('--catalog-only')
assert.ok(process.argv[2] && existsSync(join(baseline, 'lib/home-data.ts')), 'Supply the pre-cleanup snapshot path')
process.loadEnvFile('.env.local')
const url = new URL(process.env.DATABASE_URL)
assert.ok(process.env.DB_TLS_EXPECTED_HOST && process.env.DB_CA_CERT_PATH)
url.hostname = process.env.DB_TLS_EXPECTED_HOST
url.port = '5432'
url.pathname = '/hod_f7_test'
url.searchParams.set('options', '-c default_transaction_read_only=on -c statement_timeout=30000')
const client = new Client({ connectionString: url.toString(), ssl: {
  rejectUnauthorized: true, ca: readFileSync(process.env.DB_CA_CERT_PATH, 'utf8'),
} })
const nativeRequire = createRequire(import.meta.url)
let reads = 0
function loader(root) {
  const cache = new Map()
  function load(relative) {
    const path = join(root, relative)
    if (cache.has(path)) return cache.get(path)
    const source = readFileSync(path, 'utf8')
    for (const match of source.matchAll(/process\.env\.(HOD_F2_[A-Z_]+)/g)) process.env[match[1]] = 'true'
    const compiled = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText
    const exports = {}
    cache.set(path, exports)
    new Function('require', 'exports', compiled)((name) => {
      if (name === 'server-only') return {}
      if (name === 'next/server') return { NextResponse: { json: Response.json }, connection: async () => {} }
      if (name === 'next/cache') return { unstable_cache: (fn) => fn, revalidateTag() {}, revalidatePath() {} }
      if (name === 'react') return { cache: (fn) => fn }
      if (name === '@/lib/db/query') return { query: async (sql, values = []) => {
        assert.match(sql.trim(), /^(select|with)\b/i, 'Parity must never write')
        reads++
        return client.query(sql, values)
      } }
      if (name === '@/lib/db/transaction') return { withTransaction() { throw new Error('Writes forbidden') } }
      if (name === '@/lib/rate-limit') return { enforceRateLimit: async () => ({ ok: true }) }
      if (name === '@/lib/supabase') return { supabase: null }
      if (name === '@/lib/server-supabase' || name === '@supabase/supabase-js') return {
        createClient: () => ({}), createSupabaseServerClient: () => ({}),
      }
      if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`)
      return nativeRequire(name)
    }, exports)
    return exports
  }
  return load
}
await client.connect()
try {
  const state = (await client.query('select current_database() as db, current_user as role, current_setting(\'transaction_read_only\') as ro')).rows[0]
  assert.deepEqual(state, { db: 'hod_f7_test', role: 'hod_app', ro: 'on' })
  const old = loader(baseline)
  const current = loader(process.cwd())
  const media = current('lib/media-url.ts').mediaUrl
  const normalize = (value) => {
    if (typeof value === 'string' && /^https?:\/\//.test(value)) return media(value)
    if (Array.isArray(value)) return value.map(normalize)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalize(entry)]))
    return value
  }
  const paths = [
    'about/founders', 'about/hero', 'about/timeline', 'about/values', 'about/wide-banner',
    'announcement-bar', 'bespoke/form-config', 'bespoke/hero', 'bespoke/manufacturing',
    'bespoke/portfolio', 'bespoke/process', 'certifications', 'collection', 'contact/hero',
    'contact/info', 'couples', 'hiphop-showcase', 'material-strip', 'promotion-popup',
    'promotion-popup/offer', 'service-banner', 'settings', 'stats', 'testimonials',
    'testimonial-marquee', 'additional-summary-details', 'footer-content', 'home-faq', 'home-hero',
  ]
  for (const name of paths) {
    if (catalogOnly) continue
    const path = `app/api/public/${name}/route.ts`
    if (!existsSync(join(baseline, path))) continue
    const request = new Request(`https://store.test/api/public/${name}`)
    const before = await old(path).GET(request)
    const after = await current(path).GET(request)
    assert.equal(after.status, before.status, name)
    assert.deepEqual(normalize(await after.json()), normalize(await before.json()), name)
    console.log(`RDS response parity: ${name}`)
  }
  for (const [path, method, args] of [
    ['lib/home-data.ts', 'getHomePageData', []],
    ['lib/home-data.ts', 'getFreshHomeHeroContent', []],
    ['lib/home-data.ts', 'getHomeSeoData', []],
    ['lib/navbar-server.ts', 'getNavbarRenderItems', []],
    ['lib/blog.ts', 'getPublishedBlogPosts', []],
    ['lib/blog.ts', 'getLiveBlogCategories', []],
    ['lib/blog.ts', 'getBlogPageHero', []],
    ['lib/education.ts', 'getPublishedEducationPosts', []],
    ['lib/education.ts', 'getEducationPageHero', []],
    ['lib/docs-pages.ts', 'getDocsPageContent', ['returns']],
    ['lib/catalog-products.ts', 'getStorefrontProductBySlug', ['princess-halo-stud-earrings']],
    ['lib/catalog-products.ts', 'getStorefrontProductCardPage', [{ page: 1, pageSize: 12 }]],
    ['lib/catalog-products.ts', 'getStorefrontProductSearchItems', ['diamond', 12]],
    ['lib/catalog-products.ts', 'getStorefrontProductDiscoveryRows', []],
  ]) {
    if (catalogOnly && path !== 'lib/catalog-products.ts') continue
    const before = await old(path)[method](...args)
    const after = await current(path)[method](...args)
    if (method === 'getStorefrontProductBySlug') assert.ok(after?.slug, 'Product parity must exercise a populated product')
    if (method === 'getStorefrontProductCardPage') assert.ok(after.products.length, 'Pagination parity must exercise populated data')
    assert.deepEqual(normalize(after), normalize(before), `${path}:${method}`)
    console.log(`RDS logic parity: ${method}`)
  }
  console.log(`Read-only parity passed (${reads} SELECT operations; no provider calls).`)
} finally { await client.end() }
