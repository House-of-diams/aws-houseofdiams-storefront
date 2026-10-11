import assert from 'node:assert/strict'
import test from 'node:test'
import { createProcessCache } from '../lib/routing-state-cache.ts'
import {
  createRoutingState,
  decideRouting,
  findLegacyTaxonomyRedirect,
  findStoredRedirect,
  isInvalidActiveTaxonomyPath,
} from '../lib/routing-state-logic.ts'

function makeState(overrides = {}) {
  return createRoutingState({
    categories: [{ id: 'cat-1', slug: 'rings' }],
    subcategories: [{ id: 'sub-1', category_id: 'cat-1', slug: 'engagement-rings' }],
    options: [{ id: 'opt-1', subcategory_id: 'sub-1', slug: 'solitaire' }],
    seo_redirects: [],
    maintenance: { enabled: false, message: '  Planned maintenance  ' },
    ...overrides,
  })
}

test('cached routing state preserves the maintenance setting and message fallback', () => {
  assert.deepEqual(makeState().maintenance, { enabled: false, message: 'Planned maintenance' })
  assert.equal(makeState({ maintenance: { enabled: true, message: null } }).maintenance.enabled, true)
  assert.match(makeState({ maintenance: null }).maintenance.message, /House of Diams/)
})

test('stored redirects match exact path and query source, safely ignore loops and unsafe targets', () => {
  const state = makeState({ seo_redirects: [
    { source_path: '/old?campaign=one', target_path: '/new', http_status: 301, is_active: true },
    { source_path: '/self', target_path: '/self', http_status: 301, is_active: true },
    { source_path: '/cycle-a', target_path: '/cycle-b', http_status: 301, is_active: true },
    { source_path: '/cycle-b', target_path: '/cycle-a', http_status: 301, is_active: true },
    { source_path: '/external', target_path: '//outside.example', http_status: 301, is_active: true },
    { source_path: '/inactive', target_path: '/target', http_status: 301, is_active: false },
  ] })
  assert.equal(findStoredRedirect(state, '/old?campaign=one'), '/new')
  assert.equal(findStoredRedirect(state, '/old'), null)
  assert.equal(findStoredRedirect(state, '/self'), null)
  assert.equal(findStoredRedirect(state, '/cycle-a'), null)
  assert.equal(findStoredRedirect(state, '/cycle-b'), null)
  assert.equal(findStoredRedirect(state, '/external'), null)
  assert.equal(findStoredRedirect(state, '/inactive'), null)
})

test('legacy taxonomy redirect preserves category/subcategory/option rules', () => {
  const state = makeState()
  assert.equal(findLegacyTaxonomyRedirect(state, '/rings', new URLSearchParams('subcategory=engagement-rings')), '/rings/engagement-rings')
  assert.equal(findLegacyTaxonomyRedirect(state, '/rings', new URLSearchParams('subcategory=engagement-rings&option=solitaire')), '/rings/engagement-rings/solitaire')
  assert.equal(findLegacyTaxonomyRedirect(state, '/rings', new URLSearchParams('subcategory=bad')), null)
  assert.equal(findLegacyTaxonomyRedirect(state, '/rings', new URLSearchParams('subcategory=engagement-rings&other=x')), null)
  assert.equal(findLegacyTaxonomyRedirect(state, '/rings', new URLSearchParams('subcategory=engagement-rings&option=bad')), null)
  assert.equal(findLegacyTaxonomyRedirect(state, '/rings/engagement-rings', new URLSearchParams('subcategory=engagement-rings')), null)
})

test('invalid taxonomy returns a 404 only below a known active category', () => {
  const state = makeState()
  assert.equal(isInvalidActiveTaxonomyPath(state, '/rings/missing'), true)
  assert.equal(isInvalidActiveTaxonomyPath(state, '/rings/engagement-rings/bad-option'), true)
  assert.equal(isInvalidActiveTaxonomyPath(state, '/rings/engagement-rings/solitaire'), false)
  assert.equal(isInvalidActiveTaxonomyPath(state, '/unknown/missing'), false)
  assert.equal(isInvalidActiveTaxonomyPath(state, '/rings'), false)
})

test('proxy routing decisions preserve maintenance, redirects, legacy paths and taxonomy 404s', () => {
  const state = makeState({ seo_redirects: [
    { source_path: '/old?campaign=one', target_path: '/new', http_status: 302, is_active: true },
  ] })
  assert.deepEqual(decideRouting(makeState({ maintenance: { enabled: true, message: 'Closed today' } }), '/shop', ''), {
    type: 'maintenance', message: 'Closed today',
  })
  assert.deepEqual(decideRouting(makeState({ maintenance: { enabled: true, message: 'Closed today' } }), '/maintenance', ''), {
    type: 'next',
  })
  assert.deepEqual(decideRouting(state, '/old', '?campaign=one'), {
    type: 'redirect', pathname: '/new', status: 301,
  })
  assert.deepEqual(decideRouting(state, '/rings', '?subcategory=engagement-rings&option=solitaire'), {
    type: 'redirect', pathname: '/rings/engagement-rings/solitaire', status: 301,
  })
  assert.deepEqual(decideRouting(state, '/rings/engagement-rings/unknown', ''), { type: 'not-found' })
  assert.deepEqual(decideRouting(state, '/unknown/child', ''), { type: 'next' })
})

test('process cache coalesces requests and refreshes after its TTL', async () => {
  let now = 0
  let loads = 0
  let release
  const cache = createProcessCache({
    load: () => {
      loads += 1
      return new Promise((resolve) => { release = resolve })
    },
    fallback: 'fallback',
    ttlMs: 30_000,
    now: () => now,
  })

  const first = cache()
  const second = cache()
  assert.equal(loads, 1)
  release('snapshot-1')
  assert.deepEqual(await Promise.all([first, second]), ['snapshot-1', 'snapshot-1'])
  assert.equal(await cache(), 'snapshot-1')
  assert.equal(loads, 1)

  now = 30_001
  const refreshed = cache()
  assert.equal(loads, 2)
  release('snapshot-2')
  assert.equal(await refreshed, 'snapshot-2')
})

test('process cache serves stale state on refresh failure and backs off repeated attempts', async () => {
  let now = 0
  let fail = false
  let loads = 0
  const cache = createProcessCache({
    load: async () => {
      loads += 1
      if (fail) throw new Error('database unavailable')
      return 'snapshot'
    },
    fallback: 'empty',
    ttlMs: 30_000,
    now: () => now,
  })

  assert.equal(await cache(), 'snapshot')
  now = 30_001
  fail = true
  assert.equal(await cache(), 'snapshot')
  assert.equal(await cache(), 'snapshot')
  assert.equal(loads, 2)
})
