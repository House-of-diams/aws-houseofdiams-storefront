import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { checkServerIdentity } from 'node:tls'
import pg from 'pg'

process.loadEnvFile('.env.local')

const url = new URL(process.env.DATABASE_URL)
for (const name of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(name)
const client = new pg.Client({
  connectionString: url.toString(),
  connectionTimeoutMillis: 15_000,
  ssl: {
    ca: readFileSync(process.env.DB_CA_CERT_PATH, 'utf8'),
    rejectUnauthorized: true,
    checkServerIdentity: (_host, certificate) => checkServerIdentity(process.env.DB_TLS_EXPECTED_HOST, certificate),
  },
})
const quote = (value) => `"${value.replaceAll('"', '""')}"`
const buckets = new Set([
  process.env.NEXT_PUBLIC_SUPABASE_COLLECTION_BUCKET || 'hod',
  process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'hod',
  'hod',
])

function classify(value) {
  const raw = value.trim()
  if (!raw || raw.startsWith('data:')) return null
  if (raw.startsWith('/_next/') || raw.startsWith('/images/') || raw.startsWith('/video/')) return { source: 'site-local', key: raw.slice(1) }
  if (/^https?:\/\//i.test(raw)) {
    let parsed
    try { parsed = new URL(raw) } catch { return { source: 'invalid', key: null } }
    const host = parsed.hostname.toLowerCase()
    const path = decodeURIComponent(parsed.pathname).replace(/^\/+/, '')
    if (host.endsWith('.supabase.co')) {
      const match = path.match(/^storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/)
      if (!match || !buckets.has(match[1])) return { source: 'supabase-other', key: null }
      return { source: 'supabase', key: match[2] }
    }
    if (host === 'media.houseofdiams.com') return { source: 'cdn', key: path }
    if (host.endsWith('.r2.dev') || host === 'r2.cloudflarestorage.com') return { source: 'r2', key: path }
    return { source: 'external', key: null, host }
  }
  if (raw.startsWith('//')) return { source: 'external', key: null }
  const path = raw.replace(/^\/+/, '')
  const storageMatch = path.match(/^storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
  if (storageMatch) return buckets.has(storageMatch[1]) ? { source: 'supabase', key: storageMatch[2] } : { source: 'supabase-other', key: null }
  return { source: 'relative', key: path }
}

const adminRequire = createRequire('D:/Main Hod/admin/package.json')
const { S3Client, ListObjectsV2Command } = adminRequire('@aws-sdk/client-s3')
const s3 = new S3Client({ region: 'us-east-1' })
const s3Keys = new Set()
let continuationToken
do {
  const page = await s3.send(new ListObjectsV2Command({ Bucket: 'house-of-diams', ContinuationToken: continuationToken }))
  for (const object of page.Contents ?? []) if (object.Key) s3Keys.add(object.Key)
  continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
} while (continuationToken)

const values = new Map()
const columns = []
try {
  await client.connect()
  await client.query('SET default_transaction_read_only = on')
  const identity = await client.query('SELECT current_user')
  if (identity.rows[0]?.current_user !== 'hod_app') throw new Error('F3 audit must use hod_app.')
  const metadata = await client.query(`
    SELECT table_name, column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND data_type IN ('text', 'character varying')
       AND (
         column_name ~* '(image|video|media|icon|logo|banner|thumbnail|poster|cover|photo)'
         OR (table_name ~* '(image|video|media|asset)' AND column_name ~* '(path|url)')
       )
       AND column_name !~* '(alt|show_|link_text|mime|type|width|height|description)'
     ORDER BY table_name, column_name
  `)
  for (const { table_name: table, column_name: column } of metadata.rows) {
    if (!(await client.query('SELECT has_table_privilege(current_user, $1, $2) AS ok', [`public.${quote(table)}`, 'SELECT'])).rows[0].ok) continue
    let rows
    try {
      rows = (await client.query(`SELECT DISTINCT ${quote(column)} AS value FROM public.${quote(table)} WHERE ${quote(column)} IS NOT NULL AND ${quote(column)} <> ''`)).rows
    } catch (error) {
      if (error.code === '42501') continue
      throw error
    }
    columns.push({ table, column, values: rows.length })
    for (const { value } of rows) {
      if (typeof value !== 'string') continue
      const parsed = classify(value)
      if (parsed && !values.has(value)) values.set(value, parsed)
    }
  }
} finally {
  await client.end()
}

const bySource = {}
const missingByExtension = {}
const missing = []
const manifest = []
const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
const collectionBucket = process.env.NEXT_PUBLIC_SUPABASE_COLLECTION_BUCKET || 'hod'
for (const [raw, parsed] of values) {
  const summary = bySource[parsed.source] ??= { references: 0, cdnPresent: 0, cdnMissing: 0 }
  summary.references++
  if (parsed.key) {
    if (s3Keys.has(parsed.key)) summary.cdnPresent++
    else {
      summary.cdnMissing++
      const extension = parsed.key.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? '(none)'
      missingByExtension[extension] = (missingByExtension[extension] ?? 0) + 1
      if (missing.length < 20) missing.push({ source: parsed.source, key: parsed.key })
      if (/^(webp|png|jpe?g|gif|svg|avif|mp4|mov|webm|m4v|ogg|ogv)$/i.test(extension)) {
        const sourceUrl = parsed.source === 'relative' && supabaseBase
          ? `${supabaseBase}/storage/v1/object/public/${collectionBucket}/${parsed.key.split('/').map(encodeURIComponent).join('/')}`
          : ['supabase', 'r2'].includes(parsed.source) ? raw : null
        if (sourceUrl) manifest.push({ key: parsed.key, sourceUrl })
      }
    }
  }
}
if (process.env.F3_MANIFEST_PATH) writeFileSync(process.env.F3_MANIFEST_PATH, JSON.stringify(manifest, null, 2))
console.log(JSON.stringify({ s3Objects: s3Keys.size, inspectedColumns: columns.length, distinctReferences: values.size, bySource, missingByExtension, missingSamples: missing }, null, 2))
