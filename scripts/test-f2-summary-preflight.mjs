import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkServerIdentity } from 'node:tls'
import pg from 'pg'

process.loadEnvFile('.env.local')
const sql = readFileSync('docs/aws-f2-summary-rls-forward.sql', 'utf8')
const block = sql.match(/DO \$f2_summary_preflight\$[\s\S]*?\$f2_summary_preflight\$;/)?.[0]
assert.ok(block, 'Missing summary RLS preflight block')

const url = new URL(process.env.DATABASE_URL)
for (const name of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(name)
const client = new pg.Client({
  connectionString: url.toString(), connectionTimeoutMillis: 15_000,
  ssl: {
    ca: readFileSync(process.env.DB_CA_CERT_PATH, 'utf8'), rejectUnauthorized: true,
    checkServerIdentity: (_host, cert) => checkServerIdentity(process.env.DB_TLS_EXPECTED_HOST, cert),
  },
})

try {
  await client.connect()
  await client.query('BEGIN READ ONLY')
  await client.query(block)
  console.log('Summary RLS preflight passed in a read-only transaction; no migration was applied.')
} finally {
  try { await client.query('ROLLBACK') } catch {}
  await client.end()
}
