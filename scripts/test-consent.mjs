// Unit tests for the cookie-consent model: what is stored, what counts as a valid decision, and which cookies get cleared.
import test from 'node:test'
import assert from 'node:assert/strict'
import { CONSENT_COOKIE, CONSENT_VERSION, buildConsentCookie, isAnalyticsCookieName, parseConsent, readConsentFromCookieString, serializeConsent } from '../lib/consent.ts'

test('a saved decision round-trips and records when it was made', () => {
  const parsed = parseConsent(serializeConsent({ analytics: true, marketing: false }, 1700000000000))
  assert.deepEqual(parsed, { v: CONSENT_VERSION, analytics: true, marketing: false, ts: 1700000000000 })
})

test('missing, malformed or tampered values count as no decision', () => {
  for (const raw of [undefined, null, '', 'abc', '%7B', encodeURIComponent('[]'), encodeURIComponent('null'), encodeURIComponent(JSON.stringify({ v: 1, analytics: 'yes', marketing: true, ts: 1 })), encodeURIComponent(JSON.stringify({ v: 1, analytics: true, marketing: true })), encodeURIComponent(JSON.stringify({ v: 99, analytics: true, marketing: true, ts: 1 }))]) {
    assert.equal(parseConsent(raw), null, String(raw))
  }
})

test('only strict booleans are stored, so truthy junk never switches tracking on', () => {
  const parsed = parseConsent(serializeConsent({ analytics: 'yes', marketing: 1 }, 5))
  assert.equal(parsed.analytics, false); assert.equal(parsed.marketing, false)
})

test('the consent cookie is found among other cookies', () => {
  const header = `a=1; ${CONSENT_COOKIE}=${serializeConsent({ analytics: false, marketing: true }, 9)}; detected_currency=INR`
  assert.deepEqual(readConsentFromCookieString(header), { v: CONSENT_VERSION, analytics: false, marketing: true, ts: 9 })
  assert.equal(readConsentFromCookieString('a=1; b=2'), null)
  assert.equal(readConsentFromCookieString(`x${CONSENT_COOKIE}=${serializeConsent({ analytics: true, marketing: true })}`), null)
})

test('cookie attributes: site-wide, six months, Lax, Secure only on https', () => {
  const secure = buildConsentCookie({ analytics: true, marketing: true }, true)
  assert.match(secure, /Path=\//); assert.match(secure, /Max-Age=15552000/); assert.match(secure, /SameSite=Lax/); assert.match(secure, /; Secure$/)
  assert.doesNotMatch(buildConsentCookie({ analytics: true, marketing: true }, false), /Secure/)
})

test('withdrawing analytics clears Google tag cookies and nothing else', () => {
  for (const name of ['_ga', '_ga_0LVQJ1YDJ0', '_gid', '_gat', '_gat_gtag_G_1', '_gcl_au']) assert.ok(isAnalyticsCookieName(name), name)
  for (const name of [CONSENT_COOKIE, 'hod_session', 'detected_currency', 'gat', 'my_ga']) assert.equal(isAnalyticsCookieName(name), false, name)
})
