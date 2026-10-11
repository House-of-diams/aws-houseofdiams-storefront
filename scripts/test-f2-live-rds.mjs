import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkServerIdentity } from 'node:tls'
import pg from 'pg'

process.loadEnvFile('.env.local')

const connectionString = process.env.DATABASE_URL
const caPath = process.env.DB_CA_CERT_PATH
const expectedHost = process.env.DB_TLS_EXPECTED_HOST
assert.ok(connectionString && caPath && expectedHost, 'RDS connection settings are required')

const url = new URL(connectionString)
for (const name of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(name)

const client = new pg.Client({
  connectionString: url.toString(),
  connectionTimeoutMillis: 15_000,
  ssl: {
    ca: readFileSync(caPath, 'utf8'),
    rejectUnauthorized: true,
    checkServerIdentity: (_host, certificate) => checkServerIdentity(expectedHost, certificate),
  },
})

try {
  await client.connect()
  await client.query('BEGIN READ ONLY')
  const result = await client.query('SELECT current_user AS role, current_setting($1) AS transaction_read_only, COUNT(*)::int AS active_categories FROM public.catalog_categories WHERE status = $2', ['transaction_read_only', 'active'])
  assert.equal(result.rows[0]?.role, 'hod_app')
  assert.equal(result.rows[0]?.transaction_read_only, 'on')
  console.log(`Read-only hod_app connection passed; ${result.rows[0].active_categories} active categories visible.`)
  const settings = await client.query('SELECT maintenance_mode_enabled FROM public.site_settings WHERE settings_key = $1', ['global_site_settings'])
  assert.equal(settings.rows.length, 1)
  console.log(`RDS maintenance mode enabled: ${settings.rows[0].maintenance_mode_enabled}.`)
  const products = await client.query("SELECT COUNT(*)::int AS active_count, COUNT(DISTINCT slug)::int AS distinct_slugs FROM public.products WHERE status = $1", ['active'])
  assert.equal(products.rows[0].active_count, products.rows[0].distinct_slugs, 'Active product slugs must be unique')
  console.log(`RDS active products visible: ${products.rows[0].active_count}; slugs unique.`)
  for (const table of [
    'cms_summary_sections', 'cms_summary_pointers',
  ]) {
    const result = await client.query(
      'SELECT to_regclass($1) IS NOT NULL AS exists, has_table_privilege(current_user, to_regclass($1), $2) AS can_select',
      [`public.${table}`, 'SELECT'],
    )
    let visible = 'n/a'
    if (result.rows[0].exists && result.rows[0].can_select) {
      await client.query('SAVEPOINT f2_probe')
      try {
        visible = (await client.query(`SELECT COUNT(*)::int AS count FROM public.${table}`)).rows[0].count
      } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT f2_probe')
        visible = `error:${error.code ?? 'unknown'}`
      }
      await client.query('RELEASE SAVEPOINT f2_probe')
    }
    console.log(`${table}: exists=${result.rows[0].exists}, hod_app_select=${result.rows[0].can_select ?? false}, visible_rows=${visible}.`)
  }
} finally {
  try { await client.query('ROLLBACK') } catch {}
  await client.end()
}
