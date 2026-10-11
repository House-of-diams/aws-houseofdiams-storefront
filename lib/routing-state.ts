import 'server-only'

import { query } from '@/lib/db/query'
import { createProcessCache } from '@/lib/routing-state-cache'
import { createRoutingState, type RoutingState, type RoutingStateInput } from '@/lib/routing-state-logic'

const ROUTING_STATE_TTL_MS = 30_000

const fallbackRoutingState = createRoutingState({
  categories: [],
  subcategories: [],
  options: [],
  seo_redirects: [],
  maintenance: null,
})

async function loadRoutingState(): Promise<RoutingState> {
  const result = await query<{ state: RoutingStateInput }>(
    `SELECT jsonb_build_object(
       'categories', COALESCE((
         SELECT jsonb_agg(jsonb_build_object('id', id::text, 'slug', slug) ORDER BY slug)
         FROM public.catalog_categories WHERE status = $1
       ), '[]'::jsonb),
       'subcategories', COALESCE((
         SELECT jsonb_agg(jsonb_build_object('id', id::text, 'category_id', category_id::text, 'slug', slug) ORDER BY slug)
         FROM public.catalog_subcategories WHERE status = $1
       ), '[]'::jsonb),
       'options', COALESCE((
         SELECT jsonb_agg(jsonb_build_object('id', id::text, 'subcategory_id', subcategory_id::text, 'slug', slug) ORDER BY slug)
         FROM public.catalog_options WHERE status = $1
       ), '[]'::jsonb),
       'seo_redirects', COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
           'source_path', source_path,
           'target_path', target_path,
           'http_status', http_status,
           'is_active', is_active
         ) ORDER BY source_path)
         FROM public.seo_redirects WHERE is_active = $2
       ), '[]'::jsonb),
       'maintenance', (
         SELECT jsonb_build_object(
           'enabled', maintenance_mode_enabled,
           'message', maintenance_mode_message
         )
         FROM public.site_settings WHERE settings_key = $3 LIMIT 1
       )
     ) AS state`,
    ['active', true, 'global_site_settings'],
    { operation: 'routing.state' },
  )

  if (!result.rows[0]?.state) throw new Error('Routing state query returned no state.')
  return createRoutingState(result.rows[0].state)
}

declare global {
  // Reuse the snapshot and in-flight refresh across Next.js development reloads.
  var __hodStorefrontRoutingStateCache: (() => Promise<RoutingState>) | undefined
}

export function getCachedRoutingState() {
  if (!globalThis.__hodStorefrontRoutingStateCache) {
    globalThis.__hodStorefrontRoutingStateCache = createProcessCache({
      load: loadRoutingState,
      fallback: fallbackRoutingState,
      ttlMs: ROUTING_STATE_TTL_MS,
    })
  }

  return globalThis.__hodStorefrontRoutingStateCache()
}
