import assert from 'node:assert/strict'
import test from 'node:test'
const { mapEducationHubRow, educationPostPath, educationHubPath, decideSingleSegment, decideTwoSegments, postsInHub, isValidRouteSegment } = await import('../lib/education-hubs.ts')

const hub = (overrides = {}) => mapEducationHubRow({ id: 1, slug: 'diamond-4cs', name: 'Diamond 4Cs', intro_html: '<p>Intro</p>', pillar_post_id: 10, seo_title: null, seo_description: null, seo_h1: null, seo_indexable: true, sort_order: 1, ...overrides })
const post = (overrides = {}) => ({ id: 10, slug: 'diamond-clarity', hubId: null, sortOrder: 1, ...overrides })

test('hub rows are mapped with safe defaults', () => {
  const mapped = mapEducationHubRow({ id: '7', slug: 'x', name: ' X ', intro_html: null, pillar_post_id: null, seo_indexable: null, sort_order: null })
  assert.equal(mapped.id, 7)
  assert.equal(mapped.name, 'X')
  assert.equal(mapped.seoIndexable, true)
  assert.equal(mapped.sortOrder, 0)
  assert.equal(mapped.introHtml, null)
  assert.equal(mapped.pillarPostId, null)
  assert.equal(mapEducationHubRow({ id: 1, slug: 'a', name: 'A', seo_indexable: false }).seoIndexable, false)
})

test('an article gets a two-level path only when its hub is published', () => {
  const hubs = [hub()]
  assert.equal(educationPostPath(post({ hubId: 1 }), hubs), '/education/diamond-4cs/diamond-clarity')
  assert.equal(educationPostPath(post({ hubId: 99 }), hubs), '/education/diamond-clarity')
  assert.equal(educationPostPath(post({ hubId: null }), hubs), '/education/diamond-clarity')
  assert.equal(educationPostPath(post({ hubId: 1 }), []), '/education/diamond-clarity', 'an unpublished hub is not in the list')
  assert.equal(educationHubPath(hub()), '/education/diamond-4cs')
})

test('one segment: a hub wins, a hubbed article redirects to its hub path, a plain article renders, unknown is 404', () => {
  const hubs = [hub()]
  assert.deepEqual(decideSingleSegment('diamond-4cs', hubs, null), { kind: 'hub', hub: hubs[0] })
  assert.deepEqual(decideSingleSegment('diamond-4cs', hubs, post({ slug: 'diamond-4cs' })), { kind: 'hub', hub: hubs[0] }, 'a hub slug beats an article with the same slug')
  assert.deepEqual(decideSingleSegment('diamond-clarity', hubs, post({ hubId: 1 })), { kind: 'redirect', to: '/education/diamond-4cs/diamond-clarity' })
  assert.deepEqual(decideSingleSegment('diamond-clarity', hubs, post()), { kind: 'article' })
  assert.deepEqual(decideSingleSegment('nothing', hubs, null), { kind: 'notFound' })
})

test('two segments: only the article inside its own published hub renders; everything else redirects or 404s', () => {
  const hubs = [hub(), hub({ id: 2, slug: 'metals', name: 'Metals' })]
  assert.deepEqual(decideTwoSegments('diamond-4cs', 'diamond-clarity', hubs, post({ hubId: 1 })), { kind: 'article' })
  assert.deepEqual(decideTwoSegments('metals', 'diamond-clarity', hubs, post({ hubId: 1 })), { kind: 'redirect', to: '/education/diamond-4cs/diamond-clarity' }, 'wrong hub in the address')
  assert.deepEqual(decideTwoSegments('diamond-4cs', 'diamond-clarity', hubs, post({ hubId: null })), { kind: 'redirect', to: '/education/diamond-clarity' }, 'article without a hub')
  assert.deepEqual(decideTwoSegments('ghost', 'diamond-clarity', hubs, post({ hubId: 1 })), { kind: 'redirect', to: '/education/diamond-4cs/diamond-clarity' }, 'unknown hub segment')
  assert.deepEqual(decideTwoSegments('diamond-4cs', 'missing', hubs, null), { kind: 'notFound' })
  assert.deepEqual(decideTwoSegments('ghost', 'missing', hubs, null), { kind: 'notFound' })
})

test('hub articles list the pillar first, then the shop order, and only that hub', () => {
  const h = hub({ pillar_post_id: 12 })
  const posts = [post({ id: 10, slug: 'a', hubId: 1, sortOrder: 2 }), post({ id: 11, slug: 'b', hubId: 2, sortOrder: 1 }), post({ id: 12, slug: 'c', hubId: 1, sortOrder: 5 }), post({ id: 13, slug: 'd', hubId: 1, sortOrder: 1 })]
  assert.deepEqual(postsInHub(posts, h).map((p) => p.slug), ['c', 'd', 'a'])
})

test('route segments that could be abused are refused before any lookup', () => {
  for (const ok of ['diamond-4cs', 'a', 'a1-b2']) assert.equal(isValidRouteSegment(ok), true, ok)
  for (const bad of ['', 'A', '../x', 'a/b', 'a b', 'a%2Fb', '-a', 'a-', 'a--b', 'x'.repeat(301), '<script>', 'a.b', 'a_b']) assert.equal(isValidRouteSegment(bad), false, bad)
})

test('no redirect loop is possible: following a redirect never redirects again', () => {
  const hubs = [hub(), hub({ id: 2, slug: 'metals', name: 'Metals' })]
  const posts = [post({ hubId: 1 }), post({ id: 11, slug: 'plain', hubId: null }), post({ id: 12, slug: 'orphan', hubId: 99 })]
  for (const p of posts) {
    for (const hubSlug of [null, 'diamond-4cs', 'metals', 'ghost']) {
      let decision = hubSlug ? decideTwoSegments(hubSlug, p.slug, hubs, p) : decideSingleSegment(p.slug, hubs, p)
      let hops = 0
      while (decision.kind === 'redirect') {
        hops += 1
        assert.ok(hops <= 1, `loop for ${p.slug} via ${hubSlug}`)
        const parts = decision.to.split('/').filter(Boolean).slice(1)
        decision = parts.length === 2 ? decideTwoSegments(parts[0], parts[1], hubs, p) : decideSingleSegment(parts[0], hubs, p)
      }
      assert.notEqual(decision.kind, 'redirect')
    }
  }
})
