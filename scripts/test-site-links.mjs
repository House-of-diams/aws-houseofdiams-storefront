import assert from 'node:assert/strict'
import test from 'node:test'
const { toSiteLink } = await import('../lib/site-links.ts')

test('links to this site become paths, whichever copy of the site they name', () => {
  assert.equal(toSiteLink('https://uat.houseofdiams.com/fine-jewellery/earrings'), '/fine-jewellery/earrings')
  assert.equal(toSiteLink('https://houseofdiams.com/shop?x=1#top'), '/shop?x=1#top')
  assert.equal(toSiteLink('http://www.houseofdiams.com/'), '/')
  assert.equal(toSiteLink('HTTPS://UAT.HOUSEOFDIAMS.COM/about'), '/about')
  assert.equal(toSiteLink('https://uat.houseofdiams.com'), '/')
  assert.equal(toSiteLink('  https://uat.houseofdiams.com/blog  '), '/blog')
})

test('other links, paths and odd values are left exactly as they are', () => {
  for (const value of ['/shop', '', 'https://example.com/a', 'https://houseofdiams.com.evil.example/x', 'https://evilhouseofdiams.com/x', 'mailto:info@houseofdiams.com', 'tel:+1555', 'javascript:alert(1)', '#top', '//houseofdiams.com/x', 'not a url']) {
    assert.equal(toSiteLink(value), value, value)
  }
  assert.equal(toSiteLink(null), '')
  assert.equal(toSiteLink(undefined), '')
})
