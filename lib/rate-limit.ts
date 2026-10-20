import { NextResponse } from 'next/server'
import { createClient, type RedisClientType } from 'redis'
import { clientIdentity } from '@/lib/trusted-proxy'

type RateLimitConfig = {
  key: string
  limit: number
  windowSeconds: number
}

type RateLimitResult = {
  ok: boolean
  limit: number
  remaining: number
  resetAt: number
  response?: NextResponse
}

type MemoryEntry = {
  count: number
  resetAt: number
}

const RATE_LIMIT_ERROR_MESSAGE = 'Too many requests. Please wait a bit and try again.'

const memoryStore = globalThis as typeof globalThis & {
  __hodRateLimitMemory?: Map<string, MemoryEntry>
  __hodRedisClient?: RedisClientType | null
  __hodRedisConnectPromise?: Promise<RedisClientType | null> | null
  __hodMissingRedisWarningLogged?: boolean
  __hodRedisRetryAt?: number
  __hodRateLimitSweptAt?: number
}

// HOD-011: memory fallback is swept of expired entries at most once a minute and
// never grows past MEMORY_MAX_ENTRIES; a failed Redis connect waits before retrying.
const MEMORY_SWEEP_MS = 60_000
const MEMORY_MAX_ENTRIES = 50_000
const REDIS_RETRY_MS = 30_000

function getMemoryStore() {
  if (!memoryStore.__hodRateLimitMemory) {
    memoryStore.__hodRateLimitMemory = new Map<string, MemoryEntry>()
  }
  return memoryStore.__hodRateLimitMemory
}

function createRateLimitHeaders(result: Pick<RateLimitResult, 'limit' | 'remaining' | 'resetAt'>) {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    'Retry-After': String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
  }
}

async function getRedisClient() {
  if (memoryStore.__hodRedisClient) {
    return memoryStore.__hodRedisClient
  }

  if (memoryStore.__hodRedisConnectPromise) {
    return memoryStore.__hodRedisConnectPromise
  }
  if ((memoryStore.__hodRedisRetryAt ?? 0) > Date.now()) return null

  const redisUrl = process.env.REDIS_URL?.trim()
  if (!redisUrl) {
    if (process.env.NODE_ENV === 'production' && !memoryStore.__hodMissingRedisWarningLogged) {
      console.error(
        'REDIS_URL is not configured in production. Rate limiting is using a per-instance memory fallback and is not globally enforced.'
      )
      memoryStore.__hodMissingRedisWarningLogged = true
    }
    return null
  }

  memoryStore.__hodRedisConnectPromise = (async () => {
    try {
      const client = createClient({ url: redisUrl })
      client.on('error', (error) => {
        console.error('Redis rate limit client error:', error)
      })
      await client.connect()
      memoryStore.__hodRedisClient = client
      return client
    } catch (error) {
      console.error('Redis rate limit connection failed:', error)
      memoryStore.__hodRedisRetryAt = Date.now() + REDIS_RETRY_MS
      return null
    } finally {
      memoryStore.__hodRedisConnectPromise = null
    }
  })()

  return memoryStore.__hodRedisConnectPromise
}

async function consumeRedisLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult | null> {
  const client = await getRedisClient()
  if (!client) return null

  const now = Date.now()
  const script = `
    local current = redis.call("INCR", KEYS[1])
    if current == 1 then
      redis.call("EXPIRE", KEYS[1], ARGV[1])
    end
    local ttl = redis.call("TTL", KEYS[1])
    return {current, ttl}
  `

  const raw = (await client.eval(script, {
    keys: [key],
    arguments: [String(windowSeconds)],
  })) as [number | string, number | string] | null

  if (!raw || raw.length < 2) {
    return null
  }

  const count = Number(raw[0] || 0)
  const ttlSeconds = Math.max(0, Number(raw[1] || windowSeconds))
  const resetAt = now + ttlSeconds * 1000
  const remaining = Math.max(0, limit - count)
  const ok = count <= limit

  return {
    ok,
    limit,
    remaining,
    resetAt,
    response: ok
      ? undefined
      : NextResponse.json(
          { error: RATE_LIMIT_ERROR_MESSAGE },
          { status: 429, headers: createRateLimitHeaders({ limit, remaining, resetAt }) }
        ),
  }
}

function sweepMemory(store: Map<string, MemoryEntry>, now: number) {
  if (now - (memoryStore.__hodRateLimitSweptAt ?? 0) < MEMORY_SWEEP_MS && store.size < MEMORY_MAX_ENTRIES) return
  memoryStore.__hodRateLimitSweptAt = now
  for (const [key, entry] of store) if (entry.resetAt <= now) store.delete(key)
  if (store.size >= MEMORY_MAX_ENTRIES) store.clear()
}

function consumeMemoryLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const store = getMemoryStore()
  const now = Date.now()
  sweepMemory(store, now)
  const current = store.get(key)

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowSeconds * 1000
    store.set(key, { count: 1, resetAt })
    return {
      ok: true,
      limit,
      remaining: limit - 1,
      resetAt,
    }
  }

  current.count += 1
  store.set(key, current)
  const remaining = Math.max(0, limit - current.count)
  const ok = current.count <= limit

  return {
    ok,
    limit,
    remaining,
    resetAt: current.resetAt,
    response: ok
      ? undefined
      : NextResponse.json(
          { error: RATE_LIMIT_ERROR_MESSAGE },
          { status: 429, headers: createRateLimitHeaders({ limit, remaining, resetAt: current.resetAt }) }
        ),
  }
}

export async function enforceRateLimit(request: Request, config: RateLimitConfig) {
  const key = `rate_limit:${config.key}:${clientIdentity(request.headers)}`

  try {
    const redisResult = await consumeRedisLimit(key, config.limit, config.windowSeconds)
    if (redisResult) {
      return redisResult
    }
  } catch (error) {
    console.error('Redis rate limit check failed, using memory fallback:', error)
  }

  return consumeMemoryLimit(key, config.limit, config.windowSeconds)
}
