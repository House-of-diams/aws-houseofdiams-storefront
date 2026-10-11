# F5 public form writes — locally completed

Updated 2026-10-09. **F5 code and local functional tests are complete. No deployment, push, or F6 work occurred.**

## Scope and gate

Read the complete original wiring plan and current/F4 status before implementation,
then rescanned the dirty `aws-storefront-staging-f0` branch at
`0adad6e8b15b3fa9e6202d648a4bcecd6499a9ec`. Existing F1–F4 and user work was
preserved. Checkout, payment, inventory, admin, Keycloak and media were not edited.

The first attempt stopped before source edits because newsletter and both promotion
write tables lacked applicable INSERT policies for `hod_app`. The user subsequently
reported COMMIT for the **revised** forward SQL and successful read-only verification.
Before continuing, a TLS-verified read-only connection as `hod_app` independently
passed the revised policy assertions and rechecked columns/types/defaults,
constraints, triggers and role/grant/RLS metadata. Schema still matches the previous
Supabase OpenAPI/RDS audit. No privileged SQL was executed by this work.

Applied policies: newsletter and secondary promotion submission have INSERT TO
hod_app WITH CHECK (true); promotion response INSERT requires an existing active
popup, matching the original response policy predicate. RLS remains enabled.
The role is neither superuser nor BYPASSRLS and inherits no Supabase service/admin
role. DBA forward/rollback scripts must **not** be replayed during normal testing.

The user's customer login/Google continuity requirement remains recorded as a
disputed historical guest-only assumption. No F6 auth decision was made.

## Exact implementation files changed

- `app/api/public/contact/submit/route.ts`
- `app/api/public/newsletter/submit/route.ts`
- `app/api/public/bespoke/submit/route.ts`
- `app/api/public/promotion-popup/submit/route.ts`
- `lib/repositories/public-forms-repository.ts` — new, contact/newsletter/bespoke INSERTs.
- `lib/repositories/promotion-submissions-repository.ts` — new, submission-specific popup/question/coupon reads and both promotion INSERTs.
- `scripts/test-f5-forms.mjs` — new, isolated real-RDS route and production HTTP tests, original-handler response parity.
- `scripts/test-f5-preflight.mjs` — additionally verifies the revised applied-policy assertions.
- `docs/aws-f5-status.md` — this updated report.
- `docs/AWS_MIGRATION_CURRENT_STATUS.md` — updated local F5 state and data-source notes.

The revised `docs/aws-f5-rls-forward.sql`, `docs/aws-f5-rls-rollback.sql`, and
`docs/aws-f5-rls-verify.sql` are retained as the DBA audit/rollback package; they
were not changed or applied during this implementation turn. No package/dependency,
ENV, UI, rate-limit, validation, payment or DB-foundation file was modified.

## Behavior and persistence

All four form APIs now call focused `server-only` repositories using the existing
`lib/db/query` foundation and parameterized SQL. No browser DB access, Supabase
fallback, dual write, submission read, or INSERT RETURNING was added.
A fresh scan found no additional public service-role mutations and no remaining
Supabase service-role import/mutation in `app/api/public`.

Validation, trimming, email lowercasing, optional-field handling, maximum lengths,
rate-limit keys/limits/order, success JSON, field errors, generic failure JSON and
HTTP statuses are preserved. Existing server sanitization is trimming/validation;
no new HTML transformation was introduced.

- Contact writes full_name/email/phone/topic/message. Database status/timestamps/identity defaults remain authoritative. Name/topic max 120, email max 254, message 10–5000, existing phone validation; five requests/minute.
- Newsletter writes email, source `homepage_newsletter`, status `new`; six requests/minute. PostgreSQL missing-table code 42P01 preserves the unavailable-storage 503 response; other insert errors remain generic 500.
- Bespoke writes the same nine submitted fields and status `new`. Name/country/piece/stone/metal max 120, carat max 80, email max 254, message 10–5000, optional validated phone; five requests/minute.
- Promotion retains active-popup lookup, active questions ordered by sort_order, required-email fallback on empty/failed question reads, all option/multiple/regex/email/phone/number validation, ignored unknown fields, and answer trimming. Coupon eligibility still checks active/start/end/usage limits and returns only code/title. Popup/coupon read errors remain 410; required-response insert failure remains generic 500.
- The secondary promotion email record remains **best-effort**. It is a separate INSERT whose error is ignored by the public flow; it does not roll back the response or prevent reveal/redirect success. No new cross-insert transaction was introduced.
- Duplicate emails continue to succeed. None of the five write tables has a unique email constraint/index; no upsert or new duplicate rejection was added.
- Coupon usage, checkout, orders, inventory and payment state are never mutated by F5.

The form configuration checks now use existing `DATABASE_URL` instead of
`SUPABASE_SERVICE_ROLE_KEY`, retaining their existing 503 JSON and ordering.
Database errors are logged centrally as operation/code only, rather than raw driver
errors from these routes. Public errors contain no PostgreSQL details.

The revised active-popup RLS rule also rejects a response if its popup becomes
inactive between the route read and INSERT; the route returns its generic storage
failure. This is the user-applied policy gate, not a new auth or coupon decision.

## Actual database requirements

Reads: `promotion_popup`, `promotion_popup_questions`, and `coupons`, using only
the submission-specific columns inspected before implementation.

INSERTs: `contact_submissions`, `newsletter_submissions`, `bespoke_submissions`,
`promotion_popup_responses`, `promotion_popup_submissions`.

Identity sequences: `contact_submissions_id_seq`,
`promotion_popup_responses_id_seq`, `promotion_popup_submissions_id_seq`; existing
sequence USAGE/SELECT grants were inspected. UUID defaults for newsletter/bespoke
invoke PostgreSQL `gen_random_uuid()`; successful real inserts verified those defaults.
No checkout/payment business function or RPC is executed by F5.

No SELECT/UPDATE/DELETE on submission rows is required. Their existing admin read
policies reference `is_admin()` and inaccessible auth-schema state; plain INSERTs
worked without widening those policies or granting auth access.
Existing broad table grants were not expanded or revoked.

## Validation results

Implemented and tested one form at a time before the combined production-runtime
check. Final coverage contains **136 distinct functional cases**: contact 28,
newsletter 22, bespoke 33, promotion 53.

| Check | Result |
| --- | --- |
| Revised F5 read-only policy verification as hod_app | PASS |
| `node scripts/test-f5-preflight.mjs` | PASS |
| Contact real RDS insert/duplicate/validation/storage/rate/config cases | PASS |
| Newsletter real RDS insert/duplicate/validation/storage/rate/config/missing-table cases | PASS |
| Bespoke real RDS insert/duplicate/validation/storage/rate/config/optional-field cases | PASS |
| Promotion real reveal/duplicate, redirect, fallback, question/coupon/rejection cases | PASS |
| `node scripts/test-f5-forms.mjs --runtime contact newsletter bespoke promotion-popup` | PASS, 133 production Next HTTP cases |
| Follow-up `node scripts/test-f5-forms.mjs --runtime promotion-popup` after three extra cases | PASS, 53 production Next HTTP cases |
| Original-handler public HTTP status/JSON parity | PASS for every production HTTP case |
| Unexpected-write checks | PASS; no outside-table INSERT, UPDATE or DELETE |
| `pnpm typecheck` | PASS |
| Targeted ESLint on all four routes, both repositories, both F5 scripts | PASS |
| `pnpm lint` | FAIL: unchanged baseline of 30 errors and 167 warnings |
| `pnpm build` | PASS, temporary shell-only DB timeout of 30000 ms |
| `pnpm test:payment-subunits` | PASS, 6/6 |
| `pnpm test:db-foundation` | PASS, 3/3 |
| Browser static credential/repository scan | PASS: 53 files, eight configured secret checks, zero secret/repository-marker matches |
| Shared Redis integration | NOT VERIFIED: local REDIS_URL is unset; existing memory fallback tested |
| Browser/manual visual form interaction | NOT RUN; production HTTP APIs were tested |
| Deployed verification | NOT RUN; no deployment authorized |

The main production suite ran 133 cases before the final three promotion additions.
The subsequent promotion suite reran its 50 previous cases plus the three new ones:
186 HTTP executions total, covering 136 distinct cases. No required DB-permission
or local form-functional case remains blocked.

Coverage includes valid writes, repeated email, malformed/wrong-type/invalid payloads,
every existing scalar length rejection, accepted length boundaries, optional defaults,
SQL-like quoted input kept in bound parameters, generic errors for permission/unique/
check/FK/unknown failures, newsletter missing storage, zero DB access after rate limit,
and preserved 503 configuration behavior.

Promotion additionally covers real current popup/questions/coupon reveal, answer email
casing versus stored lowercase email, legacy body.email, optional/no-email response,
ignored fields, option allowlists and deduplication, text/email/phone/number/regex errors,
empty/failed question lookup fallback, inactive/missing/error popup, inactive/not-started/
expired/exhausted/missing/error coupon, redirect/default/unknown action, required-response
failure, best-effort failure on redirect **and reveal**, a real secondary email CHECK
rejection, and a real active-popup RLS rejection. Rare configuration/error branches
use test-only SELECT results or injected SQL errors; successful destination INSERTs
and both final database rejection examples execute real PostgreSQL statements.

The parity comparator executes handlers from the pinned original baseline commit with
simulated Supabase persistence/limiter results corresponding to the observed case.
It compares actual public status and parsed JSON. It never sends Supabase requests or
writes; it is response-contract regression evidence, not a live Supabase write test.

## Test isolation and side effects

The HTTP tests serve the actual production build through a local Next.js server bound
to loopback on an ephemeral port, allowing only the four form POST endpoints.
A **test-only** pool adapter uses the existing singleton hook plus request context to
route each request's queries to its own TLS-verified `hod_app` transaction.
Every case ends with ROLLBACK, including assertion failures; no transaction commits.
Application source contains no test flag, rollback behavior or alternate connection.
Server and pool were closed after each run.

The adapter records SQL/parameters/driver row counts in memory and checks
`pg_stat_xact_user_tables` for unexpected physical writes, updates and deletes.
Savepoints let test transactions inspect failures and subsequently roll back;
production uses the ordinary shared pool/autocommit behavior.
Because submission SELECT policies do not expose rows to hod_app, persisted-value
checks use bound parameters and actual INSERT row counts rather than broadening RLS.

**No test submission rows were committed. Bigint sequence values were consumed by
test INSERTs; PostgreSQL sequence increments are not rolled back.** No sequence reset,
privileged cleanup, fixture popup/coupon edits, or grant/policy change was performed.

## Environment variables and remaining dependencies

Added: none. Removed: none. ENV files unchanged.

F5 uses existing `DATABASE_URL`, DB pool tuning and the local tunnel TLS settings
`DB_CA_CERT_PATH`/`DB_TLS_EXPECTED_HOST`. Build temporarily set
`DB_CONNECTION_TIMEOUT_MS=30000` only in its shell, as documented for F2/F4.
No new flags, AWS access keys or DB master credentials were introduced.

Existing `REDIS_URL` behavior remains; **the current local value is unset**, so these
rate-limit tests cover the existing per-process memory fallback. Configure/test the
intended shared Upstash endpoint before deployment; do not infer production-wide
throttling from these local 429 tests.

Keep all Supabase/R2 ENVs and dependencies. They remain required for the untouched
customer auth/profile, checkout/payment/recovery, cron and later-phase consumers.
Public form submissions themselves no longer depend on the Supabase service key.

## Manual checks and risks before eventual deployment

1. Verify deployed form UI submission/success/error states, promotion reveal and
   redirect, and expected rows through a suitably authorized admin/DB review.
2. Configure and test the shared Upstash REDIS_URL, including limits across more than
   one application instance and trusted CloudFront client headers.
3. Verify deployed hod_app network/TLS/ENV setup and the applied policies.
4. Recheck single authoritative database for writes at final cutover; do not deploy
   this intermediate migration independently of the overall migration plan.
5. Resolve the existing Fixer API access configuration: build again reported invalid
   access and emergency display-rate fallbacks. F5 did not change currency code;
   payment regression tests still verify non-USD charging rejects fallback FX.
6. Full lint still has its established 30-error baseline; this phase added no lint
   errors. Broader browser, deployed and full-migration regression remain later gates.

**Ready for further phase planning: YES, after explicit user instruction.
No production readiness claim. Stop after F5; do not start F6 automatically.**
