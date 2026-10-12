'use client'

type PublicJsonResult<T> = { ok: boolean; payload: T | null }

const DEFAULT_TTL_MS = 60_000
const entries = new Map<string, { expiresAt: number; promise: Promise<PublicJsonResult<unknown>> }>()

/**
 * Shared GET for public, non-personalised endpoints. Components that ask for the
 * same URL while a request is in flight or within the TTL share one network call
 * (this also absorbs React Strict Mode's double effect run in development).
 * Failed responses are not kept, so the next caller retries.
 */
export function fetchPublicJson<T>(url: string, ttlMs = DEFAULT_TTL_MS): Promise<PublicJsonResult<T>> {
  const now = Date.now()
  const cached = entries.get(url)
  if (cached && cached.expiresAt > now) return cached.promise as Promise<PublicJsonResult<T>>

  const promise = fetch(url)
    .then(async (response) => ({ ok: response.ok, payload: (await response.json().catch(() => null)) as T | null }))
    .then((result) => {
      if (!result.ok) entries.delete(url)
      return result
    })
    .catch((error: unknown) => {
      entries.delete(url)
      throw error
    })

  entries.set(url, { expiresAt: now + ttlMs, promise })
  return promise
}
