# F7 implementation and verification report

> **F8 follow-up, 2026-10-11:** [F8 report](./aws-f8-implementation-report.md) records authorized disabled preparation and real clone tests. Immediate RDS refunds now queue durable recovery, webhook completion is generation-bound, and shared provider checks reject refunded/wrong-ID payments. Earlier refund/F8-not-started descriptions below are historical; activation remains unapproved.

Updated 2026-10-11. **F7 remains incomplete and disabled.** The remaining application transport is implemented locally behind the server-only, OFF-by-default `HOD_F7_RDS_WRITE_PREPARED` flag, which also requires `HOD_CUSTOMER_AUTH_ENABLED=true`. The existing F6 proxy and checkout-page placement guards were retained. Saved auth, write-preparation, and read-preview flags were not enabled. Nothing was deployed. F8 was not started.

## Implemented routes and behavior

| Route | Prepared RDS behavior |
| --- | --- |
| `POST /api/checkout/place` | Verified customer-session or guest-hash ownership, RDS authoritative preparation, owner-scoped attempt insertion/collision/retry, Razorpay order creation, existing atomic pending-order creation, attempt completion/failure. The unchanged F6 proxy still returns 503 before this handler in customer-auth mode. |
| `POST /api/checkout/cancel` | Owner-filtered order lookup, gateway payment inspection, paid/nonfailed-payment protection, transactional cancellation. |
| `POST /api/payments/verify` | Owner-filtered order lookup, stored gateway-order match, existing HMAC and amount/currency/capture checks, atomic finalization, durable recovery claim/refund handling. |
| `POST /api/payments/webhook` | Signature before processing; existing atomic event claim, replay protection, stored-order amount/currency validation before capture, finalization, pending-only failure, refund-result persistence, checked completion. Signed requests without an event header use a deterministic body digest for deduplication. |
| `GET /api/checkout/success` | Owner-filtered order/items/history, stored-currency totals, owner-bound pending self-reconciliation, existing result CMS, `catalog_categories`, new `order_status_history`, CDN media. |
| `GET /api/profile/orders` | Verified customer session, bounded pagination, customer-owned orders/items only. No guest history enumeration. |
| `GET /api/checkout/profile` | Verified customer owner and separate `customer_profiles` repository. Date-only strings retain the legacy response representation. |
| `/api/checkout/quote`, `/coupon`, `/tax` | Existing RDS read slices now automatically select RDS whenever the prepared write transport is selected. Preview still requires customer-auth mode and the placement guard. |
| `POST /api/create-order` | Unchanged: direct creation remains disabled. |

Every new RDS mutation entry point checks the write gate. RDS errors return generic public messages. New pending storefront orders explicitly set `fulfillment_mode='made_to_order'` and `user_id=NULL`; verified Keycloak identity IDs go exclusively into `customer_identity_id`. Guest hashes remain a separate owner type. Prices, tax, coupon, gift, charge snapshots, love letters, and gateway response fields are retained. Numeric SQL fields are converted for the existing JSON response conventions.

Customer-mode checkout/success UI uses HttpOnly session requests instead of Supabase bearer sessions. Legacy mode remains available under the existing configuration. Customer account history is connected to the guarded RDS read API. The checkout page itself remains blocked in F6 mode until the release gate passes.

### Cancellation contract

The installed `cancel_pending_checkout(uuid,uuid)` is a **legacy auth.users** function, not a Keycloak-customer function. It is never called with a customer identity ID. Guest cancellation retains `cancel_pending_guest_checkout(uuid,text)`. Customer cancellation filters and locks the customer-owned pending order, checks `made_to_order`, calls the existing reservation-release function, and writes `checkout_dismissed` within one transaction. No new SQL function or broad grant is required. This customer cancellation transaction still needs isolated database concurrency tests.

## Exact source files changed in this implementation pass

Earlier dirty worktree changes were preserved. This list identifies this pass, not all changes relative to Git HEAD.

```text
app/api/checkout/place/route.ts
app/api/checkout/cancel/route.ts
app/api/checkout/success/route.ts
app/api/checkout/profile/route.ts
app/api/payments/verify/route.ts
app/api/payments/webhook/route.ts
app/api/profile/orders/route.ts
app/checkout/page.tsx
app/checkout/success/page.tsx
app/profile/page.tsx
components/checkout/CheckoutPageClient.tsx
components/checkout/CheckoutSuccessClient.tsx
components/auth/CustomerAccount.tsx
lib/checkout-order.ts
lib/f7-write-prepared.ts
lib/f7-read-preview.ts
lib/f7-checkout-handlers.ts                         (new)
lib/f7-webhook-handler.ts                           (new)
lib/f7-result-handlers.ts                           (new)
lib/f7-payment.ts                                   (new)
lib/repositories/checkout-attempt-repository.ts
lib/repositories/checkout-repository.ts             (new)
lib/repositories/payment-repository.ts              (new)
lib/repositories/checkout-result-repository.ts      (new)
lib/repositories/checkout-profile-repository.ts     (new)
lib/repositories/customer-orders-repository.ts      (new)
scripts/test-f7-checkout.mjs                        (new)
scripts/test-f7-contract.mjs                        (new)
scripts/test-f7-http-readonly.mjs                   (new)
package.json
docs/aws-f7-implementation-report.md                (new)
docs/aws-f7-status.md
docs/aws-f7-execution-sequence.md
docs/aws-f7-f8-work-plan.md
docs/AWS_MIGRATION_CURRENT_STATUS.md
docs/HOD_STOREFRONT_AWS_WIRING_PLAN.md
```

`lib/f7-checkout-owner.ts` was inspected and tested without modification. Quote/coupon/tax route bodies and pricing math were reused without new business-rule rewrites. `proxy.ts`, the reconciliation cron, `lib/payment-recovery.ts` legacy logic, admin, media infrastructure, and existing atomic SQL function definitions were not changed in this pass.

## SQL and environment requirements

No staging SQL was executed except read-only queries. Do **not** rerun the already-applied ACL, customer-ownership, made-to-order, JPY, or order-history forwards. The obsolete original `test-f7-sql-preflight.mjs` was not run.

The new contract check uses strict TLS/CA, `hod_app`, and `BEGIN READ ONLY`. It verifies all 15 scoped function signatures, owners/security/ACLs, the six made-to-order function branches, separate owner columns/constraints, JPY amount branch, history RLS/trigger, intentionally revoked direct commerce privileges, and actual read repositories. Staging remains authoritative. No schema/function-signature mismatch was found.

Existing grants are sufficient for the implemented contract:

- Direct reads: orders, order items, checkout attempts, payment recovery actions, payment webhook events, customer profiles/sessions/identities, result CMS, contact info, catalog categories, order history, products/variants/purity/custom configuration/GST, site settings, coupons.
- Direct writes: checkout-attempt INSERT/UPDATE; owner-filtered orders UPDATE; webhook-event and recovery-action UPDATE.
- Atomic function calls: `create_pending_order_v2`, `cancel_pending_guest_checkout`, `release_order_inventory_reservation`, `finalize_paid_order_with_coupon_secure`, `claim_payment_webhook_event`, `claim_payment_recovery_action`.
- No direct order/order-item INSERT, coupon-redemption access, inventory-reservation access, or new sequence grant. Existing functions/triggers perform their existing privileged internal work. No master role, auth-schema access, or browser DB policy was added.

Added server flag: `HOD_F7_RDS_WRITE_PREPARED` (unset/false by default). Existing server flags/config: `HOD_CUSTOMER_AUTH_ENABLED`, `HOD_F7_RDS_READ_PREVIEW`, F6 OIDC/session settings, `DATABASE_URL`, CA/tunnel TLS configuration, Razorpay, live FX, email, Redis. No public DB flag or credential was added. No ENV/dependency was removed; `.env.local` was not edited. Upstash was not changed. The local Fixer key remains invalid, so non-USD live charging/UAT cannot pass with the current local configuration.

## Validation results

| Check | Result | Limits |
| --- | --- | --- |
| `npm run typecheck` | PASS | Also passed during production build. |
| `npm run lint -- --format json --output-file .codex-temp/f7-eslint-current.json` | FAIL, unchanged baseline | 30 errors / 167 warnings. Baseline comparison found zero added/removed substantive findings, accounting for source-line shifts. |
| Focused lint on new F7 code/repositories/tests | PASS | Existing unrelated lint failures remain. |
| Production build | PASS on retry | Initial attempt compiled/typechecked but failed because Next reloaded the saved tunnel-only TLS host after deletion from process ENV. Retry explicitly set the process-only override empty and used direct RDS with strict CA validation. DB sessions were forced read-only. No saved ENV edits. |
| `npm run test:payment-subunits` | PASS, 7/7 | Existing JPY, delayed-failure, and non-USD FX protections. |
| `npm run test:db-foundation` | PASS, 3/3 | Error normalization; not an isolated SQL mutation test. |
| F6 local auth tests | PASS, 9/9 | Signed-token/origin/session tests; not Keycloak/Google UAT. |
| `npm run test:f7-checkout` | PASS, 28/28 | Real pricing/preparation/HMAC/capture code with explicitly mocked repositories/provider. No ENV files loaded; external dependencies cannot be reached. Covers ownership, idempotency, retries, pricing/coupons/gifts, failure, cancellation, JPY, replay, recovery, success snapshots/history, SQL parameters/gates. |
| `node scripts/test-f7-contract.mjs` | PASS | Strict-TLS read-only metadata and actual read-repository checks as `hod_app`. No SQL functions invoked for mutation. |
| `node scripts/test-f7-http-readonly.mjs` | PASS, 14 HTTP checks | Local production server, fake F6/Razorpay configuration, all DB sessions forced read-only. Guard/missing/wrong-owner rejection, invalid webhook signature, zero-stock USD quote, quantity-10 gift coupon, tax. Server stopped afterward. |
| Browser bundle secret scan | PASS | 53 browser JS bundles; eight configured server-secret/DB-password checks plus PostgreSQL connection-string pattern; zero matches. No values printed. |
| Commerce row checks | PASS | Orders, attempts, items, history remained zero before/after read-only checks. Runtime test connections could not write. |
| Isolated SQL mutation/concurrency regressions | NOT RUN | No isolated DB configuration supplied; Docker/PostgreSQL tools are not installed locally. |
| UAT login/payment/webhook/refund flows | NOT RUN | No real login, Razorpay order/capture/refund, or valid provider webhook was sent. |

The first coupon HTTP fixture used a quantity below the existing minimum-order requirement and correctly returned 400. Increasing the test quantity to ten met that requirement and passed; no coupon policy was changed.

## Required remaining gate

Provision a separate disposable PostgreSQL database matching the authoritative RDS schema, functions, triggers, and application grants. Run mutations there using synthetic gateway fixtures, including:

1. Guest/customer A/B ownership, invalid/expired sessions, idempotency races, failed-attempt retry with new keys, provider-order/pending-order/completion failure boundaries.
2. Atomic pending-order insertion, all paid/gift configurations, zero physical stock, coupon redemption exactly once, price/tax/FX snapshots including JPY.
3. Made-to-order creation/payment/cancel/failure produces **no physical reservation, deduction, adjustment, or restoration**. Legacy/admin inserts and payment/cancellation retain their pre-existing behavior.
4. Concurrent cancel/verify/failure/webhook/duplicate finalization, captured-state/amount/currency/order rejection, payment-ID mismatch, event claim leases/replay/retry, durable recovery/refund states, pending expiry and order-history triggers. Do not modify or invoke the F8 cron as part of this pass.

Then run configured UAT password/Google login, expiry/logout/profile/history, guest/customer checkout, Razorpay **test-mode** order/capture/failure/callback/webhook/replay/refund, live non-USD FX, email, Redis, and deployed infrastructure checks. A controlled UAT setup must be reviewed before changing the current placement guard; flags alone intentionally cannot open customer checkout.

**Safe to continue:** isolated testing/provisioning and F6/F7 UAT preparation. **Not safe:** enable auth/checkout, relax the F6 guard, deploy/cut over payments, declare F7 complete, or start F8. Mocked tests and SQL metadata checks cannot establish database concurrency, inventory non-effects, or real identity/payment behavior.
