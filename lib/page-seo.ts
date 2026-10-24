import 'server-only'

import type { Metadata } from 'next'
import { mediaUrl } from '@/lib/media-url'
import { cachePublicRead, PUBLIC_CACHE_LONG_SECONDS } from '@/lib/public-cache'
import {
  findSiteSeoSettingsFromRds,
  loadPageSeoRowsFromRds,
  type PageSeoRow,
  type SiteSeoSettingsRow,
} from '@/lib/repositories/seo-repository'
import { createPageMetadata } from '@/lib/seo'

/** Fixed pages whose title and description an editor can override (CMS > SEO). */
export type FixedPageKey =
  | 'about' | 'b2b' | 'bespoke' | 'blog' | 'collection' | 'contact' | 'education' | 'faq'
  | 'privacy-policy' | 'returns' | 'shipping' | 'shop' | 'terms'

const getCachedPageSeoRows = cachePublicRead('page-seo-rows', () => loadPageSeoRowsFromRds(), PUBLIC_CACHE_LONG_SECONDS)
const getCachedSiteSeoSettings = cachePublicRead('site-seo-settings', () => findSiteSeoSettingsFromRds(), PUBLIC_CACHE_LONG_SECONDS)

// SEO overrides are optional: if they cannot be read, pages keep their built-in text.
async function readOrFallback<T>(label: string, read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read()
  } catch (error) {
    console.error(`[seo] Unable to load ${label}; using built-in values.`, error)
    return fallback
  }
}

export async function getPageSeoOverride(key: FixedPageKey): Promise<PageSeoRow | null> {
  const rows = await readOrFallback('page SEO', getCachedPageSeoRows, [] as PageSeoRow[])
  return rows.find((row) => row.page_key === key) ?? null
}

export async function getSiteSeoSettings(): Promise<SiteSeoSettingsRow | null> {
  return readOrFallback('site SEO settings', getCachedSiteSeoSettings, null)
}

/** Metadata for a fixed page: editor overrides first, then the page's built-in text. */
export async function createFixedPageMetadata(
  key: FixedPageKey,
  defaults: { title: string; description: string; path: string; image?: string | null }
): Promise<Metadata> {
  const [override, settings] = await Promise.all([getPageSeoOverride(key), getSiteSeoSettings()])
  const metadata = createPageMetadata({
    title: override?.seo_title?.trim() || defaults.title,
    description: override?.seo_description?.trim() || defaults.description,
    path: defaults.path,
    image: mediaUrl(override?.og_image_path) || defaults.image || mediaUrl(settings?.default_og_image_path) || undefined,
  })
  return override && !override.seo_indexable ? { ...metadata, robots: { index: false, follow: true } } : metadata
}
