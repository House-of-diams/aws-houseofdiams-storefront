import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

process.loadEnvFile('.env.local')

const manifestPath = process.env.F3_MANIFEST_PATH
const bucket = process.env.F3_S3_BUCKET
if (!manifestPath || bucket !== 'house-of-diams') throw new Error('Set F3_MANIFEST_PATH and F3_S3_BUCKET=house-of-diams.')
const apply = process.argv.includes('--apply')
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : Infinity
if (!(limit > 0 && (Number.isInteger(limit) || limit === Infinity))) throw new Error('Invalid --limit.')

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const unique = [...new Map(manifest.map((item) => [item.key, item])).values()].slice(0, limit)
const allowedSourceHosts = new Set([new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname])
for (const item of unique) {
  if (!/^[a-zA-Z0-9_./() -]+\.(webp|svg|jpe?g|png|gif|avif|mp4|mov|webm|m4v|ogg|ogv)$/i.test(item.key) || item.key.includes('..') || item.key.startsWith('/')) throw new Error(`Unsafe media key: ${item.key}`)
  const source = new URL(item.sourceUrl)
  if (source.protocol !== 'https:' || !allowedSourceHosts.has(source.hostname)) throw new Error(`Unexpected source for key: ${item.key}`)
}

const adminRequire = createRequire('D:/Main Hod/admin/package.json')
const { S3Client, HeadObjectCommand, PutObjectCommand } = adminRequire('@aws-sdk/client-s3')
const s3 = new S3Client({ region: 'us-east-1' })
const mimeByExtension = {
  webp: 'image/webp', svg: 'image/svg+xml', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', gif: 'image/gif', avif: 'image/avif', mp4: 'video/mp4',
  mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/x-m4v',
  ogg: 'video/ogg', ogv: 'video/ogg',
}
const result = { planned: unique.length, copied: 0, alreadyPresent: 0, unavailable: 0, failed: 0, bytes: 0 }
const failures = []

async function head(key) {
  try { return await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key })) }
  catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) return null
    throw error
  }
}

async function migrate(item) {
  try {
    const existing = await head(item.key)
    if (existing) { result.alreadyPresent++; return }
    if (!apply) return
    const response = await fetch(item.sourceUrl, { signal: AbortSignal.timeout(45_000) })
    if (!response.ok) { result.unavailable++; failures.push({ key: item.key, reason: `source HTTP ${response.status}` }); return }
    const length = Number(response.headers.get('content-length') || 0)
    if (length > 200 * 1024 * 1024) throw new Error('Source exceeds 200 MB limit.')
    const body = Buffer.from(await response.arrayBuffer())
    if (!body.length || body.length > 200 * 1024 * 1024) throw new Error('Invalid source size.')
    const extension = item.key.split('.').at(-1).toLowerCase()
    const checksum = createHash('sha256').update(body).digest('base64')
    try {
      await s3.send(new PutObjectCommand({
        Bucket: bucket, Key: item.key, Body: body,
        ContentType: mimeByExtension[extension],
        CacheControl: 'public, max-age=86400',
        ChecksumSHA256: checksum,
        IfNoneMatch: '*',
      }))
    } catch (error) {
      if (error.$metadata?.httpStatusCode === 412) { result.alreadyPresent++; return }
      throw error
    }
    const uploaded = await head(item.key)
    if (uploaded?.ContentLength !== body.length) throw new Error('S3 size verification failed.')
    result.copied++
    result.bytes += body.length
  } catch (error) {
    result.failed++
    failures.push({ key: item.key, reason: error.code || error.name || 'unknown' })
  }
}

let nextIndex = 0
async function worker() {
  while (nextIndex < unique.length) {
    const index = nextIndex++
    await migrate(unique[index])
    if ((index + 1) % 100 === 0) console.log(JSON.stringify({ processed: index + 1, ...result }))
  }
}
await Promise.all(Array.from({ length: 5 }, worker))
console.log(JSON.stringify({ ...result, apply, failures: failures.slice(0, 50) }, null, 2))
if (result.failed || result.unavailable) process.exitCode = 1
