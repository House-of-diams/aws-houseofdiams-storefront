// Unit tests for the helpers that stand between stored/user text and the page: escaping, sanitising and link checks.
import test from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml } from '../lib/escape-html.ts'
import { getSafeContactHref } from '../lib/contact-links.ts'
import { sanitizeRichText, sanitizeEmphasisTitle, sanitizeInlineSvg } from '../lib/sanitize-html.ts'
import { getSiteUrl, getCanonicalUrl } from '../lib/site-url.ts'

test('escapeHtml neutralises every HTML metacharacter and tolerates non-strings', () => {
  assert.equal(escapeHtml(`<script>alert("x")</script> & 'q'`), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;')
  assert.equal(escapeHtml(null), ''); assert.equal(escapeHtml(undefined), ''); assert.equal(escapeHtml(42), '42')
  assert.equal(escapeHtml('&amp;'), '&amp;amp;', 'already-escaped text is escaped again, never trusted')
})

test('contact links: only http(s), mailto, tel and site-relative links survive', () => {
  for (const ok of ['https://wa.me/919328536178', 'http://example.com', 'mailto:a@b.co', 'tel:+911234567890', '/contact', '  https://x.co  ']) assert.ok(getSafeContactHref(ok), ok)
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>', 'vbscript:x', '//evil.example/x', ' ', '', null, undefined, 'ftp://x']) assert.equal(getSafeContactHref(bad), null, String(bad))
})

test('rich text: scripts, event handlers and dangerous URL schemes are removed, formatting is kept', () => {
  const dirty = '<p onclick="x()">Hi <strong>there</strong><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a><a href="https://ok.example" target="_blank">ok</a><iframe src="https://evil"></iframe></p>'
  const clean = sanitizeRichText(dirty)
  assert.doesNotMatch(clean, /<script|onclick|onerror|<img|<iframe|javascript:/i)
  assert.match(clean, /<strong>there<\/strong>/); assert.match(clean, /href="https:\/\/ok\.example"/)
  assert.doesNotMatch(sanitizeRichText('<a href="//evil.example">x</a>'), /href="\/\/evil/)
  assert.doesNotMatch(sanitizeRichText('<a href="data:text/html;base64,AAAA">x</a>'), /data:/)
  assert.doesNotMatch(sanitizeRichText('<div style="background:url(javascript:alert(1))">x</div>'), /style=/)
})

test('emphasis titles only allow <em>', () => {
  assert.equal(sanitizeEmphasisTitle('Forever <em>yours</em><b>!</b><script>x</script>'), 'Forever <em>yours</em>!')
})

test('inline SVG: shapes survive, scripts, handlers, links and foreign content do not', () => {
  const dirty = '<svg viewBox="0 0 10 10" onload="x()"><script>alert(1)</script><path d="M0 0L5 5" fill="red"/><foreignObject><iframe src="x"></iframe></foreignObject><a href="javascript:x"><circle cx="1" cy="1" r="1"/></a><use href="#a"/></svg>'
  const clean = sanitizeInlineSvg(dirty)
  assert.doesNotMatch(clean, /<script|onload|foreignObject|<iframe|<a |javascript:|<use/i)
  assert.match(clean, /<path d="M0 0L5 5" fill="red"/); assert.match(clean, /viewBox="0 0 10 10"/)
})

test('site URLs: scheme added when missing, trailing slashes removed, paths resolved against the site', () => {
  const saved = { a: process.env.NEXT_PUBLIC_SITE_URL, b: process.env.SITE_URL }
  try {
    delete process.env.NEXT_PUBLIC_SITE_URL; delete process.env.SITE_URL
    assert.equal(getSiteUrl(), 'https://houseofdiams.com')
    process.env.SITE_URL = 'example.test///'; assert.equal(getSiteUrl(), 'https://example.test')
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000/'; assert.equal(getSiteUrl(), 'http://localhost:3000')
    assert.equal(getCanonicalUrl('shop/ring').href, 'http://localhost:3000/shop/ring')
    assert.equal(getCanonicalUrl('/a').pathname, '/a')
  } finally { for (const [k, v] of [['NEXT_PUBLIC_SITE_URL', saved.a], ['SITE_URL', saved.b]]) v === undefined ? delete process.env[k] : (process.env[k] = v) }
})
