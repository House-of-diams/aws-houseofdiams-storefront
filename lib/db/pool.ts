import { readFileSync } from 'node:fs'
import { checkServerIdentity } from 'node:tls'
import { Pool, type PoolConfig } from 'pg'

const DEFAULT_POOL_MAX = 10
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000
const DEFAULT_IDLE_TIMEOUT_MS = 30_000

declare global {
  var __hodStorefrontPostgresPool: Pool | undefined
}

function readPositiveInteger(name: string, fallback: number, maximum: number) {
  const rawValue = process.env[name]?.trim()
  if (!rawValue) return fallback

  const value = Number(rawValue)
  if (!Number.isInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${name} must be a positive integer no greater than ${maximum}.`)
  }

  return value
}

function readDatabaseUrl() {
  const rawValue = process.env.DATABASE_URL?.trim()
  if (!rawValue) {
    throw new Error('DATABASE_URL is required for PostgreSQL access.')
  }

  let databaseUrl: URL
  try {
    databaseUrl = new URL(rawValue)
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.')
  }

  if (databaseUrl.protocol !== 'postgresql:' && databaseUrl.protocol !== 'postgres:') {
    throw new Error('DATABASE_URL must use the postgresql protocol.')
  }

  // TLS is configured explicitly below so connection-string options cannot
  // weaken certificate verification.
  databaseUrl.searchParams.delete('sslmode')
  databaseUrl.searchParams.delete('sslcert')
  databaseUrl.searchParams.delete('sslkey')
  databaseUrl.searchParams.delete('sslrootcert')

  return databaseUrl.toString()
}

function createPoolConfig(): PoolConfig {
  const connectionString = readDatabaseUrl()
  const connectionHost = new URL(connectionString).hostname
  const caPath = process.env.DB_CA_CERT_PATH?.trim()
  const expectedHost = process.env.DB_TLS_EXPECTED_HOST?.trim()

  if (expectedHost && !caPath) {
    throw new Error('DB_CA_CERT_PATH is required when DB_TLS_EXPECTED_HOST is set.')
  }
  if (expectedHost && (
    !['localhost', '127.0.0.1'].includes(connectionHost) ||
    !/^[a-z0-9-]+\.[a-z0-9-]+\.us-east-1\.rds\.amazonaws\.com$/.test(expectedHost)
  )) {
    throw new Error('DB_TLS_EXPECTED_HOST requires a local tunnel to an RDS hostname.')
  }

  const ssl: NonNullable<PoolConfig['ssl']> = {
    rejectUnauthorized: true,
    ...(caPath ? { ca: readFileSync(caPath, 'utf8') } : {}),
    ...(expectedHost ? {
      // pg connects to localhost through SSM. Verify the server certificate
      // against its real RDS DNS name, never against the tunnel endpoint.
      checkServerIdentity: (_hostname: string, certificate: Parameters<typeof checkServerIdentity>[1]) =>
        checkServerIdentity(expectedHost, certificate),
    } : {}),
  }

  return {
    connectionString,
    max: readPositiveInteger('DB_POOL_MAX', DEFAULT_POOL_MAX, 100),
    connectionTimeoutMillis: readPositiveInteger(
      'DB_CONNECTION_TIMEOUT_MS',
      DEFAULT_CONNECTION_TIMEOUT_MS,
      120_000,
    ),
    idleTimeoutMillis: readPositiveInteger(
      'DB_IDLE_TIMEOUT_MS',
      DEFAULT_IDLE_TIMEOUT_MS,
      600_000,
    ),
    ssl,
  }
}

function createPool() {
  const pool = new Pool(createPoolConfig())

  pool.on('error', (error: Error & { code?: string }) => {
    console.error('[db] Unexpected idle client error.', {
      code: typeof error.code === 'string' ? error.code : 'unknown',
    })
  })

  return pool
}

export function getPool() {
  if (!globalThis.__hodStorefrontPostgresPool) {
    globalThis.__hodStorefrontPostgresPool = createPool()
  }

  return globalThis.__hodStorefrontPostgresPool
}
