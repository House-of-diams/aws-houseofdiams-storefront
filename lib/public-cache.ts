import { unstable_cache } from 'next/cache'

// Shared tag for public CMS reads so a future admin "publish" hook can call
// revalidateTag(PUBLIC_CONTENT_TAG) and refresh every cached section at once.
export const PUBLIC_CONTENT_TAG = 'public-content'

// Fast-changing admin content (hero, promotions, settings) vs. slow content.
export const PUBLIC_CACHE_SHORT_SECONDS = 60
export const PUBLIC_CACHE_LONG_SECONDS = 300

/**
 * Caches a public, non-personalised database read on the server so repeated
 * visitors share one RDS query per window. Never use for per-user data.
 * Errors are not cached; the next request retries the read.
 */
export function cachePublicRead<T>(key: string, read: () => Promise<T>, revalidateSeconds: number) {
  return unstable_cache(read, ['public-read', key], {
    revalidate: revalidateSeconds,
    tags: [PUBLIC_CONTENT_TAG],
  })
}

/** Lets CloudFront share a successful public response across visitors. */
export function publicCacheHeaders(seconds: number) {
  return { 'Cache-Control': `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds}` }
}
