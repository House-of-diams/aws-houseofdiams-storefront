import assert from 'node:assert/strict'
import test from 'node:test'
import { auditHtml } from './seo-live-check.mjs'

const page = ({ canonical = 'https://houseofdiams.com/about', h1 = '<h1>About</h1>', title = 'About | House of Diams', description = '<meta name="description" content="About us."/>', robots = '', ld = '<script type="application/ld+json">{"@type":"Organization"}</script>' } = {}) =>
  `<html><head><title>${title}</title>${description}${robots}<link rel="canonical" href="${canonical}"/>${ld}</head><body>${h1}</body></html>`

const audit = (html, url = 'https://houseofdiams.com/about') => auditHtml(html, url, 'houseofdiams.com')

test('a clean page passes', () => assert.deepEqual(audit(page()).problems, []))

test('every kind of mistake is reported', () => {
  assert.match(audit(page({ canonical: 'https://uat.houseofdiams.com/about' })).problems.join(), /canonical points at uat\.houseofdiams\.com/)
  assert.match(audit(page({ canonical: 'https://houseofdiams.com/other' })).problems.join(), /canonical points at \/other/)
  assert.match(audit(page({ h1: '' })).problems.join(), /0 H1/)
  assert.match(audit(page({ h1: '<h1>A</h1><h1>B</h1>' })).problems.join(), /2 H1/)
  assert.match(audit(page({ title: '' })).problems.join(), /no title/)
  assert.match(audit(page({ title: 'x'.repeat(80) })).problems.join(), /title is 80/)
  assert.match(audit(page({ description: '' })).problems.join(), /no meta description/)
  assert.match(audit(page({ description: `<meta name="description" content="${'x'.repeat(200)}"/>` })).problems.join(), /meta description is 200/)
  assert.match(audit(page({ robots: '<meta name="robots" content="noindex, follow"/>' })).problems.join(), /noindex/)
  assert.match(audit(page({ ld: '<script type="application/ld+json">{broken</script>' })).problems.join(), /not valid JSON/)
  assert.match(audit(page(), 'https://uat.houseofdiams.com/about').problems.join(), /address is on uat/)
  assert.match(audit(page().replace('</body>', '<a href="https://uat.houseofdiams.com/x">x</a></body>')).problems.join(), /mentions uat/)
})

test('a trailing slash and relative canonical are accepted; a missing or duplicate canonical is not', () => {
  assert.deepEqual(audit(page({ canonical: '/about' })).problems, [])
  assert.deepEqual(audit(page({ canonical: 'https://houseofdiams.com/about/' })).problems, [])
  assert.match(audit(page().replace('<link rel="canonical" href="https://houseofdiams.com/about"/>', '')).problems.join(), /0 canonical/)
  assert.match(audit(page().replace('</head>', '<link rel="canonical" href="https://houseofdiams.com/about"/></head>')).problems.join(), /2 canonical/)
})
