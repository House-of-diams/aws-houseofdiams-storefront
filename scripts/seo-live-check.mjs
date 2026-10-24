// Live SEO check. Reads the sitemap and audits every page it lists.
//   node scripts/seo-live-check.mjs [https://houseofdiams.com] [--limit=50] [--concurrency=6]
// Per page it checks: status 200, address on the expected host, one canonical that points at the page itself,
// exactly one H1, a title and a meta description of sensible length, no stray noindex, valid structured data.
// Exit code 1 when any problem is found, so it can run after every deploy.
import { pathToFileURL } from 'node:url'

const text = (value) => value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

export function auditHtml(html, pageUrl, expectedHost) {
  const problems = []
  const url = new URL(pageUrl)
  if (url.host !== expectedHost) problems.push(`address is on ${url.host}, not ${expectedHost}`)

  const canonicals = [...html.matchAll(/<link[^>]+rel="canonical"[^>]*>/gi)].map((match) => (match[0].match(/href="([^"]*)"/i) || [])[1])
  if (canonicals.length !== 1) problems.push(`${canonicals.length} canonical tags`)
  else {
    const canonical = new URL(canonicals[0], url)
    if (canonical.host !== expectedHost) problems.push(`canonical points at ${canonical.host}`)
    else if (canonical.pathname.replace(/\/$/, '') !== url.pathname.replace(/\/$/, '')) problems.push(`canonical points at ${canonical.pathname}`)
  }

  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => text(match[1])).filter(Boolean)
  if (h1s.length !== 1) problems.push(`${h1s.length} H1 headings`)

  const title = text((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '')
  if (!title) problems.push('no title')
  else if (title.length > 75) problems.push(`title is ${title.length} characters`)

  const description = (html.match(/<meta[^>]+name="description"[^>]*content="([^"]*)"/i) || html.match(/<meta[^>]+content="([^"]*)"[^>]*name="description"/i) || [])[1] || ''
  if (!description.trim()) problems.push('no meta description')
  else if (description.length > 175) problems.push(`meta description is ${description.length} characters`)

  const robots = (html.match(/<meta[^>]+name="robots"[^>]*content="([^"]*)"/i) || [])[1] || ''
  if (/noindex/i.test(robots)) problems.push(`noindex (${robots})`)

  for (const block of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(block[1]) } catch { problems.push('structured data is not valid JSON') }
  }
  if (/uat\.houseofdiams\.com/i.test(html)) problems.push('mentions uat.houseofdiams.com')
  return { title, h1: h1s[0] || '', problems }
}

async function main() {
  const args = process.argv.slice(2)
  const base = (args.find((arg) => arg.startsWith('http')) || 'https://houseofdiams.com').replace(/\/+$/, '')
  const limit = Number((args.find((arg) => arg.startsWith('--limit=')) || '').split('=')[1]) || Infinity
  const concurrency = Number((args.find((arg) => arg.startsWith('--concurrency=')) || '').split('=')[1]) || 6
  const expectedHost = new URL(base).host

  const sitemap = await (await fetch(`${base}/sitemap.xml`, { cache: 'no-store' })).text()
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].replace(/&amp;/g, '&')).slice(0, limit)
  console.log(`Sitemap: ${urls.length} addresses on ${base}`)

  const failures = []
  let next = 0
  async function worker() {
    while (next < urls.length) {
      const url = urls[next++]
      try {
        const response = await fetch(url, { redirect: 'manual', cache: 'no-store' })
        if (response.status !== 200) { failures.push([url, [`status ${response.status}`]]); continue }
        const { problems } = auditHtml(await response.text(), url, expectedHost)
        if (problems.length) failures.push([url, problems])
      } catch (error) {
        failures.push([url, [`request failed: ${error.message}`]])
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))

  if (failures.length === 0) { console.log('All pages passed.'); return }
  const byProblem = new Map()
  for (const [url, problems] of failures) for (const problem of problems) byProblem.set(problem, [...(byProblem.get(problem) || []), url])
  for (const [problem, list] of [...byProblem].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${list.length} x ${problem}`)
    for (const url of list.slice(0, 5)) console.log(`   ${url}`)
    if (list.length > 5) console.log(`   ... and ${list.length - 5} more`)
  }
  console.log(`\n${failures.length} of ${urls.length} pages have problems.`)
  process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
