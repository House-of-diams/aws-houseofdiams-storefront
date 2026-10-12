#!/usr/bin/env node
// Post-deploy cache warm-up: visits every page in the sitemap so the shared
// server cache is filled before customers arrive.
//
// Usage: node scripts/warm-cache.mjs https://your-site-or-internal-url [concurrency]
// Run it against each new server instance (or its internal URL) after deploy.

const baseUrl = (process.argv[2] || process.env.WARM_BASE_URL || '').replace(/\/+$/, '')
const concurrency = Math.max(1, Math.min(8, Number(process.argv[3] || 4)))
const REQUEST_TIMEOUT_MS = 60_000

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

const sitemap = await fetch(`${baseUrl}/sitemap.xml`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
if (!sitemap.ok) {
  console.error(`Could not read ${baseUrl}/sitemap.xml (HTTP ${sitemap.status}).`)
  process.exit(1)
}

// Sitemap URLs carry the public domain; replay their paths against baseUrl.
const paths = [...new Set(
  [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => {
    try { return new URL(loc).pathname } catch { return null }
  }).filter(Boolean)
)]

console.log(`Warming ${paths.length} pages on ${baseUrl} (${concurrency} at a time)...`)
const results = []
let next = 0
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < paths.length) {
    const result = await timedGet(paths[next++])
    results.push(result)
    if (result.status !== 200) console.warn(`  ${result.status || 'ERR'} ${result.path}${result.error ? ` (${result.error})` : ''}`)
  }
}))

const failed = results.filter((result) => result.status !== 200)
const slowest = [...results].sort((a, b) => b.ms - a.ms).slice(0, 5)
console.log(`Done: ${results.length - failed.length} ok, ${failed.length} failed.`)
console.log('Slowest:', slowest.map((result) => `${result.path} ${result.ms}ms`).join(', '))
process.exit(failed.length > results.length * 0.1 ? 1 : 0)
