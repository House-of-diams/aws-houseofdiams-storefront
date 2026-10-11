export type ProcessCacheOptions<T> = {
  load: () => Promise<T>
  fallback: T
  ttlMs: number
  now?: () => number
}

/** A process-local TTL cache with request coalescing and stale-on-error reads. */
export function createProcessCache<T>({ load, fallback, ttlMs, now = Date.now }: ProcessCacheOptions<T>) {
  let cached: { value: T; expiresAt: number } | undefined
  let retryAfter = 0
  let inFlight: Promise<T> | undefined

  return async function getCachedValue(): Promise<T> {
    const currentTime = now()
    if (cached && currentTime < cached.expiresAt) return cached.value
    if (inFlight) return inFlight
    if (currentTime < retryAfter) return cached?.value ?? fallback

    inFlight = load()
      .then((value) => {
        cached = { value, expiresAt: now() + ttlMs }
        retryAfter = 0
        return value
      })
      .catch(() => {
        retryAfter = now() + ttlMs
        return cached?.value ?? fallback
      })
      .finally(() => {
        inFlight = undefined
      })

    return inFlight
  }
}
