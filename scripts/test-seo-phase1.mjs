import assert from 'node:assert/strict'
import test from 'node:test'
const { sanitizePageCopy } = await import('../lib/sanitize-html.ts')
const { createBlogPostingSchema, createOrganizationSchema } = await import('../lib/structured-data.ts')

test('editor copy: unsafe markup is removed and an H1 never becomes a second page H1', () => {
  const html = sanitizePageCopy('<h1>Title</h1><p onclick="x()">a <a href="javascript:alert(1)">b</a></p><script>alert(1)</script><img src=x onerror=alert(1)><iframe src="https://evil.example"></iframe><a href="https://ok.example/p">ok</a>')
  assert.match(html, /<h2>Title<\/h2>/)
  assert.doesNotMatch(html, /<h1|script|onclick|onerror|javascript:|<img|<iframe/i)
  assert.match(html, /href="https:\/\/ok\.example\/p"/)
})

test('editor copy: data and protocol-relative links are dropped', () => {
  const html = sanitizePageCopy('<a href="data:text/html;base64,AAAA">x</a><a href="//evil.example/y">y</a><a href="vbscript:z">z</a>')
  assert.doesNotMatch(html, /data:|\/\/evil|vbscript/i)
})

const post = (overrides = {}) => ({ slug: 'a-guide', title: 'A guide', titleRaw: 'A guide', subtitle: 'Intro', author: 'House of Diams', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-03-04T00:00:00Z', ...overrides })

test('BlogPosting: the brand byline is an Organization, a named person stays a Person', () => {
  assert.equal(createBlogPostingSchema(post()).author['@type'], 'Organization')
  assert.equal(createBlogPostingSchema(post({ author: 'HOD Team' })).author['@type'], 'Organization')
  assert.equal(createBlogPostingSchema(post({ author: 'Asha Rao' })).author['@type'], 'Person')
  assert.equal(createBlogPostingSchema(post({ author: 'House of Diams, with Asha Rao' })).author['@type'], 'Person')
  assert.equal(createBlogPostingSchema(post({ author: '' })).author['@type'], 'Organization')
})

test('BlogPosting: first publish date wins over created date; bad dates are omitted, not "Invalid Date"', () => {
  assert.equal(createBlogPostingSchema(post({ publishedAt: '2026-02-01T00:00:00Z' })).datePublished, '2026-02-01T00:00:00.000Z')
  assert.equal(createBlogPostingSchema(post()).datePublished, '2026-01-02T00:00:00.000Z')
  const broken = createBlogPostingSchema(post({ publishedAt: 'garbage', createdAt: 'garbage', updatedAt: 'garbage' }))
  assert.equal(broken.datePublished, undefined)
  assert.equal(broken.dateModified, undefined)
})

test('Organization: only https profile links reach structured data; defaults fill empty settings', () => {
  const org = createOrganizationSchema({ org_name: ' ', org_logo_path: null, org_same_as: ['https://www.instagram.com/hod', 'http://insecure.example', 'javascript:alert(1)', '  https://www.linkedin.com/company/hod  '] })
  assert.deepEqual(org.sameAs, ['https://www.instagram.com/hod', 'https://www.linkedin.com/company/hod'])
  assert.equal(org.name, 'House of Diams')
  assert.equal(createOrganizationSchema(null).sameAs, undefined)
})
