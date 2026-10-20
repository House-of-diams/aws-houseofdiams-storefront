import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { currencyForCountry, normalizeCountryCode } from '../lib/country-currency.ts'
import { getTrustedClientIp } from '../lib/trusted-proxy.ts'

test('CloudFront country values normalize and keep the existing currency map', () => {
  assert.equal(normalizeCountryCode(' in '), 'IN')
  assert.equal(normalizeCountryCode('USA'), '')
  assert.equal(currencyForCountry('IN'), 'INR')
  assert.equal(currencyForCountry('FR'), 'EUR')
  assert.equal(currencyForCountry('ZZ'), 'USD')
})

test('rate-limit identity uses only the validated CloudFront viewer address', () => {
  const makeHeaders = (entries) => new Headers(entries)
  assert.equal(getTrustedClientIp(makeHeaders({ 'cloudfront-viewer-address': '203.0.113.8:443', 'x-forwarded-for': '198.51.100.3' })), '203.0.113.8')
  assert.equal(getTrustedClientIp(makeHeaders({ 'cloudfront-viewer-address': '[2001:db8::1]:443' })), '2001:db8::1')
  assert.equal(getTrustedClientIp(makeHeaders({ 'cloudfront-viewer-address': '2001:db8::2:443' })), '2001:db8::2')
  assert.equal(getTrustedClientIp(makeHeaders({ 'x-forwarded-for': '198.51.100.3', 'x-real-ip': '198.51.100.4' })), null)
  assert.equal(getTrustedClientIp(makeHeaders({ 'cloudfront-viewer-address': 'attacker:443', 'x-forwarded-for': '198.51.100.3' })), null)
  assert.equal(getTrustedClientIp(makeHeaders({ 'cloudfront-viewer-address': '203.0.113.8:70000' })), null)
})

test('storefront currency detection no longer reads Vercel country headers', async () => {
  const [proxy, layout] = await Promise.all([
    readFile(new URL('../proxy.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8'),
  ])
  assert.match(proxy, /cloudfront-viewer-country/)
  assert.match(layout, /cloudfront-viewer-country/)
  assert.doesNotMatch(proxy + layout, /x-vercel-ip-country/)
})

test('HOD-011: without a trusted address, browsers get separate rate-limit keys', async () => {
  const { clientIdentity } = await import('../lib/trusted-proxy.ts')
  const a = clientIdentity(new Headers({ 'user-agent': 'Browser A', 'accept-language': 'en' }))
  const b = clientIdentity(new Headers({ 'user-agent': 'Browser B', 'accept-language': 'en' }))
  assert.match(a, /^unknown:[0-9a-f]{16}$/)
  assert.notEqual(a, b)
  assert.equal(clientIdentity(new Headers({ 'user-agent': 'Browser A', 'accept-language': 'en' })), a)
  assert.equal(clientIdentity(new Headers({ 'cloudfront-viewer-address': '203.0.113.8:443', 'user-agent': 'x' })), '203.0.113.8')
})
