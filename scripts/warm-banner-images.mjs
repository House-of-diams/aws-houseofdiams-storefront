#!/usr/bin/env node
// Pre-builds the Next Image copies of the home banners so the first visitor does not
// wait for the server to convert a large master. Reads the home page, collects every
// /_next/image URL it advertises for hero, collection and bespoke banners (all the
// device widths Next would pick), and requests each one.
//
// Usage: node scripts/warm-banner-images.mjs https://uat.houseofdiams.com [concurrency]
// Run it after publishing a new banner in the admin. Keep concurrency low (default 2).

const baseUrl = (process.argv[2] || process.env.WARM_BASE_URL || '').replace(/\/+$/, '')
const concurrency = Math.max(1, Math.min(4, Number(process.argv[3] || 2)))
const BANNER_PATH = /(?:hero|collection-page|bespoke-showcase)(?:%2F|\/)/i

if (!/^https?:\/\//.test(baseUrl)) {
  console.error('Usage: node scripts/warm-banner-images.mjs https://example.com [concurrency]')
  process.exit(2)
}

const html = await (await fetch(`${baseUrl}/`, { headers: { 'user-agent': 'hod-banner-warmup' }, signal: AbortSignal.timeout(60_000) })).text()
const urls = [...new Set([...html.matchAll(/\/_next\/image\?[^"'\s,]+/g)]
  .map(([match]) => match.replaceAll('&amp;', '&'))
  .filter((url) => BANNER_PATH.test(url)))]

if (!urls.length) {
  console.error('No banner image URLs found on the home page.')
  process.exit(1)
}

let next = 0
let failed = 0
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < urls.length) {
    const url = urls[next++]
    const started = performance.now()
    try {
      const response = await fetch(`${baseUrl}${url}`, { headers: { accept: 'image/webp,image/*', 'user-agent': 'hod-banner-warmup' }, signal: AbortSignal.timeout(120_000) })
      const bytes = (await response.arrayBuffer()).byteLength
      if (!response.ok) failed += 1
      console.log(`${response.status} ${Math.round(performance.now() - started)}ms ${Math.round(bytes / 1024)}KB ${url.slice(0, 110)}`)
    } catch (error) {
      failed += 1
      console.log(`ERR ${url.slice(0, 110)} ${error instanceof Error ? error.message : error}`)
    }
  }
}))
console.log(`${urls.length} banner image sizes requested, ${failed} failed.`)
process.exit(failed ? 1 : 0)
