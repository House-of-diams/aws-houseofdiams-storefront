> Current implementation update (2026-10-11): the user authorized local F9 cleanup, which is now implemented and verified. F8 is locally prepared with gates OFF; F10 deployed regression remains pending. Use [the current status](./AWS_MIGRATION_CURRENT_STATUS.md) and [F9 report](./aws-f9-implementation-report.md) as the source of truth. Earlier progress/prerequisite notes below are historical.

# House of Diams Storefront — AWS Wiring Plan for Codex

> **Progress as of 2026-10-11:** This plan is **not complete**. F0�F5 are locally implemented with deployment checks outstanding. F6 is a disabled customer-auth preview awaiting UAT. F7 SQL is applied and read-only verified; the guarded RDS application transport is implemented locally with tests passing, but isolated mutation/concurrency/stock tests and identity/payment UAT remain. Saved flags are OFF and the F6 placement guard remains. F8�F10 have not started. See [the current handoff](./AWS_MIGRATION_CURRENT_STATUS.md) and [F7 implementation report](./aws-f7-implementation-report.md). Original assumptions below are historical and may be superseded by those documents.

> Scope: **storefront/frontend only** — `dhruval12098/HOD`
> Audited baseline: `main` commit `0adad6e8b15b3fa9e6202d648a4bcecd6499a9ec` (`frontend ui update`)
> Admin panel is explicitly **out of scope** for this document.

## Goal

Detach the storefront runtime from Supabase and Cloudflare R2 and wire it safely to:

- PostgreSQL on AWS RDS through RDS Proxy
- CloudFront for public media already copied to S3
- Redis/ElastiCache-compatible endpoint for shared rate limiting
- Existing Razorpay, Fixer/APILayer, SMTP, Google Geocoding, GA/GTM and IndexNow integrations

Existing test customers/orders/payments are being cleaned before this migration. Customer account migration is therefore not required now. The first AWS storefront release should use **guest checkout only** while preserving all current payment, inventory, idempotency and recovery protections.

---

# 1. Non-negotiable Codex rules

1. Work **one phase at a time** and stop after every phase.
2. Do not touch the admin repository.
3. Do not combine UI/UX redesign, SEO work or unrelated refactors with this migration.
4. Do not introduce Prisma or another ORM. Use `pg` and a thin repository layer.
5. Do not rewrite existing PostgreSQL atomic functions unless a verified compatibility issue requires it.
6. Do not replay all historical Supabase migrations on RDS.
7. Do not commit real `.env` values.
8. This project does **not** use AWS Secrets Manager. Runtime secrets are provided through deployment/ECS environment configuration.
9. The storefront must **not** receive `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`.
10. The storefront does not upload media, so it does not need S3 write credentials.
11. Use parameterized SQL only.
12. Never log `DATABASE_URL`, passwords, Razorpay secrets, SMTP credentials, cron secrets or API keys.
13. Preserve server-authoritative pricing, checkout idempotency, guest ownership, inventory reservation/release, webhook deduplication, payment recovery, coupon logic and signature checks.
14. If schema/function signatures differ from expectations, stop and report instead of guessing.
15. Before each phase, re-scan the current branch because files may have changed after this audit.
16. After each phase run:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`
   - `npm run test:payment-subunits`
17. Do not remove `@supabase/supabase-js` until the final removal phase and only after a repo-wide search proves it is unused.

---

# 2. Exact ENV inventory from the current storefront

## 2.1 New AWS migration ENVs required by storefront

```env
# PostgreSQL — use the RDS Proxy endpoint in this URL
DATABASE_URL=postgresql://APP_DB_USER:APP_DB_PASSWORD@RDS_PROXY_ENDPOINT:5432/DB_NAME

# Public CloudFront domain in front of the copied S3 media
NEXT_PUBLIC_MEDIA_CDN_BASE_URL=https://media.example.com

# Shared production rate limiting
REDIS_URL=redis://YOUR_REDIS_ENDPOINT:6379
```

Optional connection tuning only if Codex actually implements/uses it:

```env
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT_MS=5000
DB_IDLE_TIMEOUT_MS=30000
```

Do not add separate `DB_HOST`, `DB_USER`, `DB_PASSWORD`, etc. if `DATABASE_URL` is the project standard.

Do not hard-code insecure SSL overrides such as `rejectUnauthorized: false`.

### Important

For this storefront phase, **do not require**:

```env
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_MEDIA_BUCKET=
```

Those are not needed to read public media through CloudFront. S3 write access belongs to the admin/upload phase later.

---

## 2.2 Existing ENVs that must stay

### Currency exchange — `lib/exchange-rates.ts`

```env
APILAYER_FIXER_API_KEY=
```

Current code also accepts this legacy alias:

```env
FIXER_API_KEY=
```

Do not change the current FX behavior during database migration. The current checkout intentionally requires a live rate for non-USD charging; preserve that rule.

### Razorpay — `lib/razorpay.ts`

```env
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_CURRENCY=INR
```

Preserve payment signature verification, webhook signature verification, amount/currency/order validation and capture checks.

### Redis / rate limiting — `lib/rate-limit.ts`

```env
REDIS_URL=
```

Production must not deliberately rely on the existing per-process memory fallback.

### Email — `lib/email.ts`

```env
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=
```

Keep the existing SMTP provider during this migration.

### Google postal/geocoding lookup — `app/api/checkout/postal-lookup/route.ts`

```env
GOOGLE_GEOCODING_KEY=
```

Server-only.

### Analytics

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_GTM_CONTAINER_ID=
```

Used by:
- `components/analytics/GoogleAnalytics.tsx`
- `components/analytics/GoogleTagManager.tsx`

### Site URL

```env
NEXT_PUBLIC_SITE_URL=https://www.example.com
```

`SITE_URL` is also currently read as a server-side fallback. Preserve it only if the deployed environment currently uses it.

Remove reliance on `VERCEL_PROJECT_PRODUCTION_URL` during AWS migration.

### Cron

```env
CRON_SECRET=
```

Used by:
- `app/api/cron/indexnow/route.ts`
- `app/api/cron/payment-reconciliation/route.ts`

The caller must continue sending:

```text
Authorization: Bearer <CRON_SECRET>
```

### IndexNow

```env
INDEXNOW_KEY=
```

Used by `lib/indexnow.ts`.

---

## 2.3 Script/development-only ENVs

```env
PEXELS_API_KEY=
PERFORMANCE_BASE_URL=
PERFORMANCE_CATEGORY_PATH=
```

These are not required core ECS storefront runtime variables unless those scripts run there.

`NODE_ENV` is platform/runtime controlled.

---

## 2.4 Old provider ENVs to remove only after migration is proven

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_COLLECTION_BUCKET=
SUPABASE_COLLECTION_BUCKET=
SUPABASE_SERVICE_ROLE_KEY=

CLOUDFLARE_R2_PUBLIC_BASE_URL=
NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_BASE_URL=
```

Provider-specific logic that also needs replacement:

```text
VERCEL
VERCEL_PROJECT_PRODUCTION_URL
CF_PAGES
CLOUDFLARE_ENV
x-vercel-ip-country
cf-connecting-ip
```

Do not delete them first. Replace the behavior, verify it, then remove them.

---

# 3. Target `.env.example`

Eventually document something equivalent to:

```env
# DATABASE
DATABASE_URL=
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT_MS=5000
DB_IDLE_TIMEOUT_MS=30000

# SITE / MEDIA
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_MEDIA_CDN_BASE_URL=

# REDIS
REDIS_URL=

# CURRENCY
APILAYER_FIXER_API_KEY=
# FIXER_API_KEY=  # legacy alias only if intentionally retained

# RAZORPAY
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_CURRENCY=INR

# EMAIL
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=

# GOOGLE
GOOGLE_GEOCODING_KEY=

# ANALYTICS
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_GTM_CONTAINER_ID=

# CRON / INDEXING
CRON_SECRET=
INDEXNOW_KEY=

# OPTIONAL TOOLING
# PERFORMANCE_BASE_URL=
# PERFORMANCE_CATEGORY_PATH=
# PEXELS_API_KEY=
```

Never put real values in `.env.example`.

---

# 4. Infrastructure prerequisites before code migration

DevOps must provide/confirm:

- RDS PostgreSQL database with HOD dump restored
- test-data cleanup completed and reviewed
- fresh RDS snapshot after cleanup
- dedicated storefront DB user/password
- DB name
- RDS Proxy endpoint
- network path from the storefront service to RDS Proxy
- Redis endpoint
- CloudFront media domain pointing to the copied S3 media
- CloudFront forwarding of viewer country information required for currency detection
- CloudFront/ALB path configured so trusted proxy headers cannot simply be spoofed through a direct public origin path

The app must connect to the **RDS Proxy endpoint**, not the old Supabase URL.

The storefront application must not use the RDS master user.

---

# 5. Phase F0 — Baseline only

## Goal

Freeze a known-good migration baseline.

## Tasks

1. Confirm branch and current commit.
2. Create/use a dedicated migration branch.
3. Do not make source changes yet.
4. Run:

```bash
npm install
npm run typecheck
npm run lint
npm run build
npm run test:payment-subunits
```

5. Record existing failures before touching code.
6. Re-run repo searches for:

```text
@supabase/supabase-js
@/lib/supabase
createSupabaseServerClient
createSupabaseServiceRoleClient
NEXT_PUBLIC_SUPABASE
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_COLLECTION_BUCKET
supabase.from
supabase.rpc
supabase.storage
getPublicUrl
supabase.auth
auth.getSession
auth.getUser
CLOUDFLARE_R2
x-vercel-ip-country
cf-connecting-ip
```

## Stop

Report baseline only. Do not start F1 automatically.

---

# 6. Phase F1 — PostgreSQL/RDS foundation

## Goal

Prove safe RDS connectivity without changing storefront behavior.

## Install

```bash
npm install pg
npm install -D @types/pg
```

Do not add Prisma.

## Create

```text
lib/db/
  pool.ts
  query.ts
  transaction.ts
  errors.ts
  health.ts
```

### `pool.ts`

Requirements:

- reads `DATABASE_URL`
- creates/reuses one `pg.Pool` per Node process
- safe during Next.js development hot reload
- small configurable pool size
- connection timeout
- idle timeout
- never logs credentials/connection string

### `query.ts`

- typed parameterized query helper
- no untrusted SQL interpolation
- central internal logging
- no raw SQL/database error leakage to public responses

### `transaction.ts`

- checkout-safe transaction helper for multi-statement cases
- rollback on failure
- client released in `finally`

### `errors.ts`

Review and normalize relevant PostgreSQL error codes, including:

```text
23505 unique_violation
23503 foreign_key_violation
23514 check_violation
42501 insufficient_privilege
P0002 project/custom not-found cases
PT409 HOD custom conflict code
22023 invalid_parameter_value
```

Do not blindly map everything to HTTP 500.

### Health

Current `app/api/health/route.ts` only returns `{ ok: true }`.

Keep a shallow application health endpoint for ALB, and add a separate DB readiness/diagnostic check using a minimal `SELECT 1` rather than making transient DB failure automatically replace otherwise healthy tasks.

## Acceptance

- app can connect through RDS Proxy
- `SELECT 1` succeeds
- no page behavior changed yet
- build/typecheck/lint pass

## Stop after F1.

---

# 7. Phase F2 — Read-only catalog/CMS migration

## Goal

Move read-only storefront data from Supabase/PostgREST to RDS before touching writes/payments.

## Key shared files already identified

```text
lib/catalog-products.ts
lib/catalog-taxonomy.ts
lib/blog.ts
lib/education.ts
lib/hiphop-hero.ts
lib/shop-by-category.ts
lib/home-data.ts
lib/docs-pages.ts
lib/navbar-server.ts
lib/maintenance.ts
lib/server-supabase.ts
```

Known server Supabase callers include:

```text
app/[categorySlug]/CategoryCollectionPageContent.tsx
app/[categorySlug]/page.tsx
app/faq/page.tsx
app/page.tsx
app/returns/page.tsx
app/shop/[slug]/page.tsx
app/sitemap.ts
app/api/public/products/category/route.ts
app/api/public/promotions/route.ts
app/api/public/service-banner/route.ts
app/api/public/promotion-popup/offer/route.ts
app/api/checkout/tax/route.ts
```

There are additional public CMS routes that instantiate Supabase directly. Re-scan first.

## Architecture

Create focused repositories such as:

```text
lib/repositories/
  catalog-repository.ts
  cms-repository.ts
  navbar-repository.ts
  settings-repository.ts
```

Do not scatter SQL through React components/pages.

Keep product normalization/business logic in its existing domain modules and replace only persistence transport.

## Preserve

- publication/status filters
- sorting
- filtering
- pagination
- not-found behavior
- current cache/revalidation behavior where still valid
- indexed query patterns
- public API response shapes

## Manual test

- homepage
- navbar/mega menu
- shop
- category/subcategory/option routes
- product pages
- search
- filters/sorts
- FAQ/returns
- blog/education
- about/bespoke/CMS sections
- sitemap
- maintenance configuration read

Do not change checkout/payment transport yet.

## Stop after F2.

---

# 8. Phase F3 — CloudFront media URL migration

## Goal

Stop constructing Supabase/R2 public URLs and resolve storefront media through CloudFront.

## Create

```text
lib/media-url.ts
```

Canonical public variable:

```env
NEXT_PUBLIC_MEDIA_CDN_BASE_URL=
```

Implement one helper such as `resolveMediaUrl(value)`.

It must safely handle:

1. null/empty value
2. new CloudFront absolute URL
3. relative media object key
4. existing Supabase public-storage URL during transition
5. existing Cloudflare R2 public URL during transition
6. intentionally external absolute URL

Do not double-prefix absolute URLs.

## Known `getPublicUrl`/storage call sites

```text
app/api/checkout/success/route.ts
app/api/public/service-banner/route.ts
app/page.tsx
app/shop/[slug]/page.tsx
components/bespoke/BespokeHero.tsx
components/hiphop/HipHopHero.tsx
components/home/Hero.tsx
```

`NEXT_PUBLIC_SUPABASE_COLLECTION_BUCKET` is also referenced by many catalog/home/navbar/docs/about/bespoke components/helpers. Perform a fresh search.

## `next.config.ts`

Migrate:

- remote image host from Supabase/R2 to CloudFront media host
- CSP media/image/connect policy as required
- remove Supabase/R2 entries only after all old references render correctly

Do not expose raw private S3 object endpoints to the browser if CloudFront is the public media path.

## Test

Product primary/gallery/variant images, navbar assets, hero, collections, about, bespoke, hip-hop, FAQ/docs, promotions, cart, checkout and success page.

## Stop after F3.

---

# 9. Phase F4 — AWS headers and `proxy.ts`

## Country/currency detection

Current `proxy.ts` uses:

```text
x-vercel-ip-country
```

Replace with CloudFront viewer country:

```text
cloudfront-viewer-country
```

Preserve detected-country/detected-currency cookies and current mapping behavior.

## Rate-limit IP

Current `lib/rate-limit.ts` contains Vercel/Cloudflare-specific branches.

Replace with AWS trusted-proxy handling. Prefer a CloudFront-provided viewer address/header if DevOps forwards it. If using `x-forwarded-for`, do not blindly trust arbitrary client-provided values.

Document the infrastructure assumption that production requests reach the app through the controlled CloudFront/ALB route.

## Critical `proxy.ts` DB issue

Current proxy performs Supabase REST lookups for:

- `seo_redirects`
- `catalog_categories`
- `catalog_subcategories`
- `catalog_options`
- maintenance state indirectly

Do **not** replace these with fresh RDS queries/connections on every matched request.

Refactor to a cached Node-side routing-state approach, route/page validation, or another safe cached design while preserving:

- maintenance rewrite
- stored SEO redirects
- legacy taxonomy redirects
- invalid taxonomy 404 behavior
- currency cookies

No redirect loops.

## Stop after F4.

---

# 10. Phase F5 — Public form writes

## Known service-role write routes

```text
app/api/public/bespoke/submit/route.ts
app/api/public/contact/submit/route.ts
app/api/public/newsletter/submit/route.ts
app/api/public/promotion-popup/submit/route.ts
```

Re-scan for additional service-role writes.

Convert them to repository calls using RDS.

Preserve:

- validation
- sanitization
- max lengths
- rate limiting
- uniqueness semantics
- generic public errors

Required architecture:

```text
Browser -> Next.js API -> validation/rate limit -> RDS
```

Never browser -> RDS.

## Stop after F5.

---

# 11. Phase F6 — Disable Supabase customer accounts; guest-only checkout

Current account UI:

```text
app/login/page.tsx
app/signup/page.tsx
app/profile/page.tsx
components/auth/AuthForm.tsx
components/auth/ProfileClient.tsx
components/common/Navbar.tsx
lib/supabase.ts
```

Profile/account APIs:

```text
app/api/profile/route.ts
app/api/profile/orders/route.ts
app/api/checkout/profile/route.ts
```

Checkout client auth use:

```text
components/checkout/CheckoutPageClient.tsx
components/checkout/CheckoutSuccessClient.tsx
```

## Target

```text
Customer login      OFF
Customer signup     OFF
Customer profile    OFF
Order history       OFF
Guest cart          ON
Guest checkout      ON
Razorpay             ON
Guest success page  ON
```

## Rules

- remove Supabase session lookup from checkout
- keep existing guest token generation/hashing
- guest token remains ownership proof
- never expose order data by order number alone
- checkout success/cancel/verify must keep guest ownership checks
- remove account prefill requests
- Navbar stops subscribing to Supabase auth state
- deliberately disable/redirect `/login`, `/signup`, `/profile`
- deliberately disable profile APIs rather than letting them fail after ENVs disappear

Do **not** remove:

- `guest_token_hash`
- idempotency
- inventory reservation/release
- order/payment tables
- payment recovery
- webhook event tracking

These are required for new guest production orders.

## Stop after F6.

---

# 12. Phase F7 — Checkout/payment DB transport

This is the highest-risk phase.

## Core files

```text
lib/checkout-order.ts
lib/checkout-pricing.ts
lib/payment-recovery.ts
lib/razorpay.ts
lib/guest-checkout.ts
lib/payment-subunits.ts
app/api/checkout/place/route.ts
app/api/checkout/cancel/route.ts
app/api/checkout/success/route.ts
app/api/checkout/coupon/route.ts
app/api/checkout/quote/route.ts
app/api/checkout/tax/route.ts
app/api/payments/verify/route.ts
app/api/payments/webhook/route.ts
```

Re-scan all checkout/payment call sites first.

## RPC conversion

Current `.rpc()` use exists in:

```text
lib/checkout-order.ts
lib/payment-recovery.ts
app/api/checkout/cancel/route.ts
app/api/payments/webhook/route.ts
app/api/cron/payment-reconciliation/route.ts
```

Do not port atomic DB logic into JavaScript without necessity.

Call the existing PostgreSQL functions directly, conceptually:

```sql
SELECT public.function_name($1, $2, ...);
```

Inspect the actual RDS signature before coding.

Suggested repositories:

```text
lib/repositories/checkout-repository.ts
lib/repositories/payment-repository.ts
```

## Preserve exactly

- server-authoritative product/configuration pricing
- coupon/free-gift rules
- tax
- live-FX requirement
- payment subunit conversion
- idempotency key handling
- checkout attempt collision handling
- guest ownership
- inventory reservation/release/finalization
- pending order creation
- Razorpay order creation
- Razorpay payment/webhook signature verification
- amount/currency/order validation
- webhook event deduplication
- paid-order finalization
- failed-payment recording
- captured-payment recovery/refund handling

## Error handling

Supabase/PostgREST response errors and `pg` errors are different. Normalize them centrally.

Do not keep code assuming Supabase `{ data, error }` objects after migration.

## Required staging tests

- normal guest checkout
- duplicate idempotency key
- invalid/inactive/unavailable item
- valid/invalid coupons
- free gift
- insufficient stock
- Razorpay order creation
- valid/invalid payment signatures
- amount/currency/order mismatch
- payment failure
- valid webhook
- duplicate webhook event
- invalid webhook signature
- payment captured/order paid
- refund paths if currently supported
- inventory finalizes once
- coupon usage does not double-count
- recovery remains durable

## Stop after F7.

---

# 13. Phase F8 — Payment reconciliation cron

Current route:

```text
app/api/cron/payment-reconciliation/route.ts
```

Current RPCs include:

```text
expire_inventory_reservations
claim_due_payment_recovery_actions
```

Convert these to direct PostgreSQL function calls.

Preserve:

- `CRON_SECRET`
- leasing/claim behavior
- processing limits
- manual-review behavior
- duplicate prevention
- logging

Also verify `app/api/cron/indexnow/route.ts` still works with the AWS scheduler/caller.

## Stop after F8.

---

# 14. Phase F9 — Final Supabase/Cloudflare storefront removal

Only begin after F1-F8 pass.

Repo-wide search and manually review every result:

```text
@supabase/supabase-js
@/lib/supabase
createSupabase
supabase.
NEXT_PUBLIC_SUPABASE
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_COLLECTION_BUCKET
.storage
getPublicUrl
.rpc(
CLOUDFLARE_R2
x-vercel-ip-country
cf-connecting-ip
VERCEL_PROJECT_PRODUCTION_URL
```

Then, only if unused:

1. remove `lib/supabase.ts`
2. remove `lib/server-supabase.ts`
3. remove Supabase imports/types
4. remove `@supabase/supabase-js`
5. remove old Supabase/R2 ENVs
6. remove Supabase/R2 CSP/image config
7. update `PROJECT_DOCUMENTATION.md`

Historical SQL migration files may still contain the word `supabase`; do not rewrite migration history just to make searches visually clean.

## Stop after F9.

---

# 15. Phase F10 — Full regression before cutover

Run:

```bash
npm run typecheck
npm run lint
npm run build
npm run test:payment-subunits
npm run performance:check
```

Manual regression:

### Site/content

- homepage
- desktop/mobile navbar
- search
- announcement bar
- maintenance mode
- redirects
- taxonomy 404s
- shop/category/subcategory/option
- product page
- FAQ/returns/about/bespoke/blog/education
- sitemap/robots

### Media

- product/gallery/variant media
- navbar/CMS media
- cart/checkout/success media
- old stored paths and new CloudFront paths
- no broken Supabase/R2 URLs

### Currency

- CloudFront country detection
- USD
- INR
- other supported currency paths
- Fixer success/failure
- non-USD checkout blocked if only emergency fallback FX is available

### Forms

- contact
- newsletter
- bespoke
- promotion popup

### Checkout/payment

- cart restore
- quantities/configurations
- coupon/free gift
- guest checkout
- postal lookup
- tax
- Razorpay success/failure
- success/cancel
- webhook
- reconciliation

### Security

Confirm browser bundle contains none of:

- DB credentials
- Razorpay key secret
- webhook secret
- SMTP password
- Google Geocoding server key
- cron secret
- Supabase service-role key

Also confirm:

- production rate limiting uses Redis
- guest A cannot view guest B's order
- raw PostgreSQL errors are never returned publicly

---

# 16. High-attention file groups from audit

## DB/Supabase foundation

```text
lib/server-supabase.ts
lib/supabase.ts
lib/navbar-server.ts
lib/home-data.ts
lib/maintenance.ts
lib/docs-pages.ts
lib/catalog-products.ts
lib/catalog-taxonomy.ts
lib/shop-by-category.ts
lib/blog.ts
lib/education.ts
lib/hiphop-hero.ts
```

## Infrastructure/routing

```text
proxy.ts
next.config.ts
lib/site-url.ts
lib/rate-limit.ts
app/api/health/route.ts
```

## Customer auth to disable

```text
app/login/page.tsx
app/signup/page.tsx
app/profile/page.tsx
components/auth/AuthForm.tsx
components/auth/ProfileClient.tsx
components/common/Navbar.tsx
app/api/profile/route.ts
app/api/profile/orders/route.ts
app/api/checkout/profile/route.ts
```

## Checkout/payment

```text
components/checkout/CheckoutPageClient.tsx
components/checkout/CheckoutSuccessClient.tsx
lib/checkout-order.ts
lib/checkout-pricing.ts
lib/payment-recovery.ts
lib/razorpay.ts
lib/guest-checkout.ts
lib/payment-subunits.ts
app/api/checkout/place/route.ts
app/api/checkout/cancel/route.ts
app/api/checkout/success/route.ts
app/api/checkout/coupon/route.ts
app/api/checkout/quote/route.ts
app/api/checkout/tax/route.ts
app/api/payments/verify/route.ts
app/api/payments/webhook/route.ts
app/api/cron/payment-reconciliation/route.ts
```

## Public forms

```text
app/api/public/bespoke/submit/route.ts
app/api/public/contact/submit/route.ts
app/api/public/newsletter/submit/route.ts
app/api/public/promotion-popup/submit/route.ts
```

## Integrations that must survive

```text
lib/exchange-rates.ts
lib/razorpay.ts
lib/email.ts
lib/indexnow.ts
app/api/checkout/postal-lookup/route.ts
components/analytics/GoogleAnalytics.tsx
components/analytics/GoogleTagManager.tsx
```

---

# 17. Do not change these business protections

Unless a proven compatibility issue requires a documented change, do not redesign:

```text
Atomic order creation
Inventory reservation
Inventory release
Payment finalization
Webhook idempotency
Payment recovery
Coupon transaction behavior
Free-gift behavior
Guest checkout ownership
Server-authoritative pricing
Razorpay signature verification
Razorpay amount/currency verification
Exchange-rate safety behavior
Input validation
Public-form sanitization
Rate limiting
Email escaping
Catalog/product normalization
```

---

# 18. DB role/permissions expectation

Codex must not solve permission failures by using the RDS master user.

Before final cutover, report the actual storefront DB requirements:

- tables read
- tables written
- sequences used
- functions executed

DevOps/DBA should grant only what the storefront application role requires.

---

# 19. Production cutover gate

Do not switch production traffic just because the build passes.

Required first:

1. cleanup complete
2. RDS snapshot complete
3. RDS Proxy tested
4. CloudFront media tested
5. Redis tested
6. storefront reads tested
7. public writes tested
8. guest checkout tested
9. Razorpay/webhooks tested
10. payment reconciliation tested
11. Supabase runtime search complete
12. no storefront Supabase runtime ENV dependency remains
13. full staging regression passes

At cutover there must be **one authoritative database for writes**. Do not create a split state where some production writes go to Supabase and others go to RDS.

---

# 20. Required Codex report after every phase

```markdown
## Phase completed
F?

## Files changed
- ...

## What changed
- ...

## Environment variables
Added:
- ...

Removed:
- ...

Still temporarily required:
- ...

## Database behavior changed
- ...

## Supabase dependencies remaining
- ...

## Validation run
- npm run typecheck: PASS/FAIL
- npm run lint: PASS/FAIL
- npm run build: PASS/FAIL
- npm run test:payment-subunits: PASS/FAIL

## Manual verification required
1. ...

## Risks / blockers
- ...

## Ready for next phase?
YES / NO

Do not begin the next phase until explicitly instructed.
```

---

# 21. First instruction to Codex

**Start with Phase F0 only.**

Re-audit the current branch against this document, verify whether the baseline commit is still current, and report anything that makes this plan stale.

Do not implement F1 until explicitly instructed.
