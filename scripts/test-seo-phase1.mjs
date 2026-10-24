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

const { getSiteUrl, getCanonicalUrl } = await import('../lib/site-url.ts')
function withEnv(env, run) {
  const keys = ['NEXT_PUBLIC_SITE_URL', 'SITE_URL', 'NODE_ENV']
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  try {
    for (const key of keys) delete process.env[key]
    Object.assign(process.env, env)
    return run()
  } finally {
    for (const key of keys) saved[key] === undefined ? delete process.env[key] : (process.env[key] = saved[key])
  }
}

test('site address: a test-environment host is never used in production', () => {
  for (const configured of ['https://uat.houseofdiams.com', 'uat.houseofdiams.com/', 'HTTPS://UAT.HOUSEOFDIAMS.COM', 'https://uat.houseofdiams.com:443/path']) {
    withEnv({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: configured }, () => assert.equal(getSiteUrl(), 'https://houseofdiams.com', configured))
    withEnv({ NODE_ENV: 'production', SITE_URL: configured }, () => assert.equal(getSiteUrl(), 'https://houseofdiams.com', configured))
  }
  withEnv({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://uat.houseofdiams.com' }, () => assert.equal(getCanonicalUrl('/shop').toString(), 'https://houseofdiams.com/shop'))
})

test('site address: real production, www and local development addresses are left alone', () => {
  withEnv({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://houseofdiams.com/' }, () => assert.equal(getSiteUrl(), 'https://houseofdiams.com'))
  withEnv({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://www.houseofdiams.com' }, () => assert.equal(getSiteUrl(), 'https://www.houseofdiams.com'))
  withEnv({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://notuat.houseofdiams.com' }, () => assert.equal(getSiteUrl(), 'https://notuat.houseofdiams.com'))
  withEnv({ NODE_ENV: 'development', NEXT_PUBLIC_SITE_URL: 'https://uat.houseofdiams.com' }, () => assert.equal(getSiteUrl(), 'https://uat.houseofdiams.com'))
  withEnv({ NODE_ENV: 'development', NEXT_PUBLIC_SITE_URL: 'http://localhost:3000/' }, () => assert.equal(getSiteUrl(), 'http://localhost:3000'))
  withEnv({ NODE_ENV: 'production' }, () => assert.equal(getSiteUrl(), 'https://houseofdiams.com'))
})

test('email links: the safe site address is used whenever a site address is configured; local development keeps localhost', async () => {
  const { getEmailSiteUrl } = await import('../lib/site-url.ts')
  withEnv({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://uat.houseofdiams.com' }, () => assert.equal(getEmailSiteUrl(), 'https://houseofdiams.com'))
  withEnv({ NODE_ENV: 'production', SITE_URL: 'uat.houseofdiams.com/' }, () => assert.equal(getEmailSiteUrl(), 'https://houseofdiams.com'))
  withEnv({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://houseofdiams.com/' }, () => assert.equal(getEmailSiteUrl(), 'https://houseofdiams.com'))
  withEnv({ NODE_ENV: 'development' }, () => assert.equal(getEmailSiteUrl(), 'http://localhost:3000'))
  withEnv({ NODE_ENV: 'development', NEXT_PUBLIC_SITE_URL: 'http://localhost:4000' }, () => assert.equal(getEmailSiteUrl(), 'http://localhost:4000'))
})
