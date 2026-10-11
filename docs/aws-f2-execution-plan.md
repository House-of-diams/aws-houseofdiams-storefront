# F2 read-only storefront execution plan

Status: in progress. This document tracks the current branch, not the original
baseline in `HOD_STOREFRONT_AWS_WIRING_PLAN.md`. It does not authorize SQL writes,
production activation, or F3/F5/F6/F7 work.

Current product-slice state (2026-10-09): the user designated RDS as the final
product data source for F2 read wiring. Supabase returns
184 active products; `hod_app` sees 183 in RDS. A table-owner read-only check confirmed
product `aa28a95a-5495-4005-aadb-c3cd5c1fa190`
(`serenelle-pear-pav-ring`) is absent from RDS, not merely hidden by RLS.
Supabase created it on 2026-10-05 and has 14 associated rows across nine
product child tables. This is source/target data drift, not an AWS permission
failure. Three existing product stock counts also differ. Live listing parity
exposed more drift: the `rosette-five-flower-bracelet` 10k white-gold variant
has price 0.10 in Supabase and 335 in RDS, and its variant media row IDs differ.
`camellia-cluster-stud-earrings` shape options appear in a different order.
The listing comparison reported 6,631 field paths across 24 category/sort
combinations; many cascade from missing data and shifted ordering. This is not
a count of distinct row differences. The user accepted RDS as the F2 source of
truth despite those Supabase differences. All four product read flags are now
ON locally after RDS-only health and route checks. This does not establish F7
checkout or inventory parity. No repair SQL has been applied.

## Current verified state

- F1 `pg` foundation and local RDS TLS readiness work. Staging uses direct RDS,
  `hod_app`, and existing Upstash Redis; no RDS Proxy or AWS keys are needed.
- F2-A taxonomy and the revised F2 master RLS migration were applied by the
  user. The separate read-only verification transaction was rolled back, not
  the migration. Do not rerun either forward SQL file.
- Taxonomy/navbar RDS reads are locally enabled with server-only flags. Their
  JSON, sitemap, category links/headings, and tested 200/404 routes matched
  Supabase. Direct-host TLS, `SELECT 1`, and a production-mode route check passed.
  The local production build required `DB_CONNECTION_TIMEOUT_MS=30000` under
  concurrent static generation; deployment configuration has not been changed.
- Product and settings reads now use RDS locally. Keep all existing Supabase
  ENVs and dependencies during F2 for later migration phases.
- The 14 reviewed F2 server-only read flags are ON in `.env.local`. The new
  summary flag is also ON after its separate RLS migration. This is
  local activation only; no production deployment has occurred.
- The user chose to keep RDS `site_settings.maintenance_mode_enabled` as it is.
  The value is `true`. With the RDS settings flag ON, the local homepage shows
  maintenance content. No privileged SQL was issued.
- Live check on 2026-10-08: the existing RDS-side `:3003/faq` returned HTTP 500;
  `:3003/api/public/settings`, `/api/public/about/hero`, and
  `/api/public/products/search?q=ring` returned 200. Port 3003 then stopped
  accepting connections. Do not restart or alter the existing tunnel during
  this handoff; repeat runtime checks when the user-managed server is available.
- A later 2026-10-08 check found both comparison servers (`:3002`, `:3003`)
  unavailable and the local RDS tunnel port closed. Live parity and direct
  `hod_app` SQL checks cannot be completed in that state. Typecheck and focused
  F2 preparation checks passed after correcting featured gift filtering and
  footer category ordering. The isolated production build passed before these
  two corrections; it has not been rerun against a live tunnel.
- On 2026-10-09, ports `15432`, `3002`, and `3003` were still closed. The new
  `scripts/test-f2-public-cms-parity.mjs` now covers the public CMS, bespoke,
  footer, homepage FAQ/hero, and summary GET APIs; it requires both comparison
  servers with the corresponding RDS flags enabled. A source scan found no
  table `.from(...)` calls in client components; client Supabase calls found
  there generate public storage URLs, which remain in the later media scope.
- The user restored the SSM tunnel later on 2026-10-09. A TLS-verified
  `hod_app` `BEGIN READ ONLY` query passed. Isolated comparison servers on
  ports 3002 and 3003 passed 22 public CMS/bespoke GET API comparisons.
  Homepage, about, editorial, bespoke, FAQ, returns, and a sampled product
  detail page had matching rendered text. Five about APIs, nine product search
  queries, and three sampled product hydration responses matched (apart from
  seven `updated_at` values in the product sample). The sitemap URL set
  differed only by the known missing `serenelle-pear-pav-ring` product. The
  prior FAQ HTTP 500 did not recur. Both comparison servers were stopped;
  port 3000 was untouched and the user-owned tunnel was left running.
- After the user's RDS source-of-truth decision, a second `hod_app` read-only
  check saw 183 active products with unique slugs. RDS-only storefront checks
  passed six category routes (112 fine jewellery, 60 engagement rings, seven
  wedding bands, four t-bar, zero hiphop, zero collection), search, product
  hydration, product detail, bespoke, homepage, and sitemap. The category
  counts total 183. The settings API returned maintenance enabled and the
  homepage served maintenance content when its RDS flag was active.
- The build's Turbopack workspace-root error came from 17 `node_modules`
  junctions pointing into an old temp copy. `pnpm install --offline` repaired
  them; `node_modules/next` now resolves within this checkout. The user will
  rerun the production build. The comparison server on 3002 was stopped;
  port 3000 and the user-owned SSM tunnel were untouched.
- The user clarified that Hip Hop Hero and Diamond Info are unused and will
  be removed later. No new RDS wiring or SQL is proposed for them. The visible
  Additional Summary Details panel is used on cart and checkout. The user
  applied the summary-only RLS forward SQL as `hod_migration` on 2026-10-09.
  A read-only `hod_app` check then saw one row in each table without error.
  The summary API returned HTTP 200 with the expected response shape using
  RDS, and `HOD_F2_RDS_SUMMARY_READS` is ON locally.
  The earlier six-table proposal was removed. Typecheck and focused ESLint
  passed before that scope reduction; rerun them on the final code.

## Execution gates for each slice

1. Rescan the current callers and list the exact files before editing. Verify
   every selected/filter/order/join column, type, FK, SELECT grant, RLS policy,
   and representative visible row as `hod_app` using read-only SQL. Stop that
   slice on mismatch; do not invent tables, columns, predicates, or grants.
2. Add parameterized SQL only in focused server-only repositories. Preserve
   existing normalization, business logic, API shape, missing/disabled behavior,
   cache/revalidation, ordering, filtering, counts, and page boundaries.
3. Keep the Supabase path behind an OFF-by-default server-only flag and ensure
   caches distinguish backends. Compare source and target where the user still
   requires parity; for product and settings reads, follow the user's later
   decision to use RDS as the source of truth. Do not silently fall back to
   Supabase on RDS errors.
4. Run typecheck, lint against F0 baseline (30 errors/119 warnings), production
   build, payment-subunit and DB-foundation tests, and focused slice tests.
   Check relevant routes in browser and production mode. Roll back the flag on
   any mismatch. Never claim the overall phase complete before all slices pass.

## Remaining work

The user-run `pnpm build` completed successfully on 2026-10-09. TypeScript,
static page generation (67/67), and optimization passed. Fixer rejected the
configured key and the build used the existing emergency currency rates; the
user explicitly deferred fixing Fixer.

The production build was then opened locally on port 3002. With the normal
settings flag, RDS maintenance mode correctly displayed the maintenance page.
For storefront inspection only, a separate process temporarily set
`HOD_F2_RDS_SETTINGS_READS=false`; the RDS setting itself and `.env.local`
were not changed. Home Hero, product detail, cart, checkout, and the Additional
Summary Details panel in cart and checkout rendered. The populated summary
showed the RDS heading `Why house of diams` and pointer `This is new pointer`.
Checkout also displayed `₹695` for the item while the summary displayed `$695`.
These content/currency issues need resolution before launch, but they do not
block the read-wiring milestone or F3 planning. Production startup also reported
no `REDIS_URL` in local configuration, so local rate limiting used a per-instance
fallback; deployment configuration must be reviewed before launch.

A scan of 57 `.next/static` JS/CSS/map files found no literal private
environment values, database URL, RDS hostname, or PEM certificate content.
The `hod_app` substring was only part of the client storage key
`hod_applied_coupon`. No production deployment has occurred. Do not start F3
until the user reviews this F2 result and explicitly approves.

## F2 completion gate

Rescan all active storefront reads; document any Supabase reads intentionally
remaining for later phases. Verify homepage, navbar, catalog, search, editorial,
support, bespoke, public GET routes, sitemap, and maintenance. Confirm no client
DB access or credential leakage and no writes. Keep Supabase ENVs/dependency.
Do not start F3 until the user reviews the F2 report and approves it.
