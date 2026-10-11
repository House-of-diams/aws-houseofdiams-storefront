import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

// Process-only build override. Saved ENV remains unchanged; every build DB
// connection targets the clone and is forced read-only by PostgreSQL startup.
process.loadEnvFile('.env.local')
const url = new URL(process.env.DATABASE_URL)
assert.ok(process.env.DB_TLS_EXPECTED_HOST && process.env.DB_CA_CERT_PATH)
url.hostname = process.env.DB_TLS_EXPECTED_HOST; url.port = '5432'; url.pathname = '/hod_f7_test'
url.searchParams.set('options', '-c default_transaction_read_only=on -c statement_timeout=30000')
process.env.DATABASE_URL = url.toString()
process.env.DB_TLS_EXPECTED_HOST = ''
process.env.HOD_CUSTOMER_AUTH_ENABLED = 'false'
process.env.HOD_F7_RDS_WRITE_PREPARED = 'false'
process.env.HOD_F8_RDS_RECONCILIATION_PREPARED = 'false'
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
  cwd: process.cwd(), env: process.env, stdio: 'inherit', windowsHide: true,
})
child.on('error', () => { console.error('Read-only build could not start.'); process.exitCode = 1 })
child.on('exit', (code) => { process.exitCode = code ?? 1 })
