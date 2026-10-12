#!/usr/bin/env node
// Post-deploy cache warm-up: visits every page in the sitemap so the shared
// server cache is filled before customers arrive, then primes product search.
//
// Usage: node scripts/warm-cache.mjs https://your-site-or-internal-url [concurrency]
// Run it against each new server instance (or its internal URL) after deploy,
// before it receives customer traffic. Keep concurrency low (default 2): a cold
// server builds every page from the database, and RDS connections are limited.

const baseUrl = (process.argv[2] || process.env.WARM_BASE_URL || '').replace(/\/+$/, '')
const concurrency = Math.max(1, Math.min(4, Number(process.argv[3] || 2)))
const REQUEST_TIMEOUT_MS = 60_000
const SEARCH_WARM_QUERY = 'ring'

if (!/^https?:\/\//.test(baseUrl)) {
  console.error('Usage: node scripts/warm-cache.mjs https://example.com [concurrency]')
  process.exit(2)
}

async function timedGet(path) {
  const started = performance.now()
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { 'user-agent': 'hod-cache-warmup' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    await response.arrayBuffer()
    return { path, status: response.status, ms: Math.round(performance.now() - started) }
  } catch (error) {
    return { path, status: 0, ms: Math.round(performance.now() - started), error: error instanceof Error ? error.message : String(error) }
  }
}

async function warmAll(paths) {
  const results = []
  let next = 0
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < paths.length) results.push(await timedGet(paths[next++]))
  }))
  return results
}

// The sitemap itself is built from the database, so allow a couple of tries.
let sitemapXml = ''
for (let attempt = 1; attempt <= 3 && !sitemapXml; attempt += 1) {
  const sitemap = await timedGet('/sitemap.xml')
  if (sitemap.status === 200) {
    sitemapXml = await (await fetch(`${baseUrl}/sitemap.xml`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })).text()
  } else {
    console.warn(`Sitemap attempt ${attempt} failed (${sitemap.status || sitemap.error}).`)
  }
}
if (!sitemapXml) {
  console.error(`Could not read ${baseUrl}/sitemap.xml.`)
  process.exit(1)
}

// Sitemap URLs carry the public domain; replay their paths against baseUrl.
const paths = [...new Set(
  [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => {
    try { return new URL(loc).pathname } catch { return null }
  }).filter(Boolean)
)]

console.log(`Warming ${paths.length} pages on ${baseUrl} (${concurrency} at a time)...`)
const firstPass = await warmAll(paths)
const retryPaths = firstPass.filter((result) => result.status !== 200).map((result) => result.path)
const retried = retryPaths.length ? await warmAll(retryPaths) : []
if (retryPaths.length) console.log(`Retried ${retryPaths.length} page(s) that failed on the first pass.`)

const finalByPath = new Map([...firstPass, ...retried].map((result) => [result.path, result]))
const results = [...finalByPath.values()]
const failed = results.filter((result) => result.status !== 200)
for (const result of failed) console.warn(`  ${result.status || 'ERR'} ${result.path}${result.error ? ` (${result.error})` : ''}`)

// Builds the in-memory search index so the first customer search is instant.
const search = await timedGet(`/api/public/products/search?q=${SEARCH_WARM_QUERY}`)
console.log(`Search index: ${search.status === 200 ? 'ready' : `FAILED (${search.status || search.error})`} in ${search.ms}ms`)

const slowest = [...firstPass].sort((a, b) => b.ms - a.ms).slice(0, 5)
console.log(`Done: ${results.length - failed.length} ok, ${failed.length} failed.`)
console.log('Slowest on first pass:', slowest.map((result) => `${result.path} ${result.ms}ms`).join(', '))
process.exit(failed.length > results.length * 0.05 || search.status !== 200 ? 1 : 0)
