// Read-only F5 metadata gate. Never inserts test rows or applies DBA SQL.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkServerIdentity } from 'node:tls'
import pg from 'pg'

process.loadEnvFile('.env.local')
const url = new URL(process.env.DATABASE_URL)
for (const name of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(name)
const client = new pg.Client({
  connectionString: url.toString(), connectionTimeoutMillis: 15_000,
  ssl: {
    ca: readFileSync(process.env.DB_CA_CERT_PATH, 'utf8'), rejectUnauthorized: true,
    checkServerIdentity: (_host, cert) => checkServerIdentity(process.env.DB_TLS_EXPECTED_HOST, cert),
  },
})
const tables = ['contact_submissions', 'bespoke_submissions', 'newsletter_submissions',
  'promotion_popup_responses', 'promotion_popup_submissions']
try {
  await client.connect()
  await client.query('BEGIN READ ONLY')
  const identity = (await client.query(`SELECT current_user, rolsuper, rolbypassrls
    FROM pg_roles WHERE rolname = current_user`)).rows[0]
  assert.equal(identity.current_user, 'hod_app')
  assert.equal(identity.rolsuper, false)
  assert.equal(identity.rolbypassrls, false)
  const verification = readFileSync('docs/aws-f5-rls-verify.sql', 'utf8')
    .match(/DO \$f5_verify\$[\s\S]*?\$f5_verify\$;/)?.[0]
  assert.ok(verification, 'Missing revised F5 policy assertions')
  await client.query(verification)
  const metadata = (await client.query(`SELECT c.relname, c.relrowsecurity,
    pg_get_userbyid(c.relowner) AS owner,
    has_table_privilege(current_user, c.oid, 'INSERT') AS insert_granted
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY($1) ORDER BY c.relname`, [tables])).rows
  assert.equal(metadata.length, tables.length)
  for (const table of metadata) {
    assert.equal(table.relrowsecurity, true)
    assert.equal(table.owner, 'hod_migration')
    assert.equal(table.insert_granted, true)
  }
  const policies = (await client.query(`SELECT tablename, policyname, permissive,
    roles, cmd, qual, with_check FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY($1)
    ORDER BY tablename, policyname`, [tables])).rows
  console.log(JSON.stringify({ identity, tables: metadata, policies }, null, 2))

  // Query pg_policy directly because pg_policies.roles is driver-specific name[].
  const missing = (await client.query(`SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY($1) AND NOT EXISTS (
      SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid
        AND p.polcmd IN ('a', '*') AND p.polpermissive
        AND (0::oid = ANY(p.polroles) OR EXISTS (
          SELECT 1 FROM pg_roles r WHERE r.oid = ANY(p.polroles)
            AND pg_has_role(current_user, r.oid, 'MEMBER'))))
    ORDER BY c.relname`, [tables])).rows.map((row) => row.relname)
  if (missing.length) {
    console.log('BLOCKED: no applicable permissive INSERT policy:', missing.join(', '))
    process.exitCode = 1
  } else {
    console.log('Metadata gate passed; functional INSERT/RLS checks still required.')
  }
} catch (error) {
  console.error('F5 preflight failed.', { code: typeof error.code === 'string' ? error.code : 'unknown' })
  process.exitCode = 1
} finally {
  try { await client.query('ROLLBACK') } catch {}
  await client.end()
}
