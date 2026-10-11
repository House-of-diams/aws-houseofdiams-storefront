# F4 AWS headers and proxy status

Updated 2026-10-09. F4 changes are implemented locally; no deployment was performed.

## Implemented locally

- Storefront currency detection reads `CloudFront-Viewer-Country` and keeps the existing country-to-currency mapping and detected-country/detected-currency cookies.
- Rate limiting derives a client IP only from a valid `CloudFront-Viewer-Address` value. It ignores `X-Forwarded-For` and `X-Real-IP`; absent or malformed CloudFront values share the `unknown` rate-limit key.
- Proxy routing and layout maintenance reads now use one parameterized RDS snapshot query for active taxonomy, active SEO redirects, and the global maintenance setting. A process-wide 30-second TTL cache coalesces refreshes, reuses the existing `pg.Pool`, and serves the last good snapshot on refresh errors. The cold-start fallback is an empty route snapshot with maintenance disabled, matching the previous fail-open behavior when remote settings could not be read.
- Stored SEO redirects retain exact `source_path` matching (including query strings), clear the query at the destination, and return HTTP 301 as before. Invalid active taxonomy children still return 404 only when their parent category is known. Legacy taxonomy redirects retain their existing query-key and hierarchy requirements. Self/invalid redirects and redirects participating in cycles are ignored to prevent redirect loops.
- Production infrastructure must route requests through the controlled CloudFront/ALB path, configure CloudFront to overwrite/forward both viewer headers, and prevent direct public access to the origin. These headers are not trustworthy when a client can bypass that path.

## Validation

- Focused F4 tests passed for currency mapping, trusted IP parsing, cache coalescing/TTL/stale-on-error, maintenance decision, exact stored redirects, legacy taxonomy redirects, invalid-slug 404 decisions, and cycle rejection.
- The exact snapshot SQL ran as `hod_app` in a TLS-verified read-only transaction and returned 6 categories, 10 subcategories, 35 options, 112 active redirects, and maintenance enabled.
- A local production server on port 3117 served `/shop/example` through the actual proxy with HTTP 200 maintenance content and set `detected_country=IN` / `detected_currency=INR` cookies when given CloudFront viewer headers. The server was stopped after the check.
- The production build passed with a temporary shell-level `DB_CONNECTION_TIMEOUT_MS=30000`, matching the documented F2 static-generation requirement. Full lint still exits nonzero with the 30 known F0 errors; targeted lint on F4 files passes. Payment-subunit, DB-foundation, and F4 tests pass.
- The staging maintenance flag is enabled, so stored redirect, legacy redirect, and invalid-slug response paths were verified through the routing-decision tests rather than served through the live proxy; maintenance intentionally takes precedence in staging.

## Read-only staging verification

The local staging connection was verified as `hod_app` inside a read-only transaction. The taxonomy tables and `site_settings` have SELECT grants and applicable active/public read policies. Their current visible counts are 6 active categories, 10 active subcategories, 35 active options, and one global settings row. The required columns match the current query behavior.

The user applied `hod_app_active_seo_redirects_read` as `hod_migration` in pgAdmin. A local TLS-verified `hod_app` `BEGIN READ ONLY` check confirmed: owner `hod_migration`, RLS enabled/not forced, existing SELECT grant, and the single expected `SELECT TO hod_app USING (is_active IS TRUE)` policy. `hod_app` sees 112 rows, all active; the authorized active count also returns 112. The active redirect sources are unique, target paths are internal, and no redirect cycles were detected. Taxonomy and maintenance schema/grants/policies remain as listed above. No DB or IAM changes were made by this work.

No Supabase REST routing lookups remain in `proxy.ts` or `lib/maintenance.ts`. All matched proxy requests consult the cached snapshot; they do not open a new database connection per request. The shared pool may establish/reuse a connection on cache load/refresh.

## Required deployment configuration

- Forward/overwrite `CloudFront-Viewer-Country` and `CloudFront-Viewer-Address` from the trusted CloudFront distribution.
- Restrict the ALB/origin so requests cannot bypass CloudFront. Do not trust forwarded headers if direct origin access remains possible.
- Keep the existing Upstash `REDIS_URL`.

No new application environment variable was added or removed. Existing Supabase configuration and dependencies remain in place for later phases. No deployment was performed. F4 validation must pass before approval; do not begin F5.
