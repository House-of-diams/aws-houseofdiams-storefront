# F8 local implementation and isolated verification

Updated 2026-10-11. **Local F8 code and isolated SQL validation are prepared; deployed UAT is not approved.** The explicit user authorization supersedes earlier “F8 must not start” wording for preparation/testing only. Saved auth/F7 flags remain OFF, the new F8 flag defaults OFF, and checkout placement guards are unchanged. No deployment, staging mutation, privileged SQL or Razorpay operation occurred.

## Implemented recovery behavior

- Cron checks `CRON_SECRET` before any work. RDS requires all three server flags: `HOD_CUSTOMER_AUTH_ENABLED`, `HOD_F7_RDS_WRITE_PREPARED`, and `HOD_F8_RDS_RECONCILIATION_PREPARED`. F7 selection without F8 returns 503 instead of reconciling the old Supabase ledger. Existing provider ENVs/dependencies and legacy branches remain until F9.
- Existing atomic reservation-expiry/recovery-claim functions remain unchanged. Limits are 1000 legacy reservation expirations, 20 discovered orders and 20 ledger actions. Discovery uses existing UPDATE RLS, row locks/`SKIP LOCKED`, server-owned JSON metadata, five-minute leases and generation tokens. Next-check ordering rotates work rather than repeatedly selecting the same oldest orders.
- Made-to-order discovery reuses the installed reservation function's **15-minute payment window** without making physical reservations. A successful provider lookup showing no capture/authorization can mark the gateway order expired. It does not cancel the business order or alter stock. Expired/dismissed orders remain eligible for later checks and late verified captures. Authorized payments are deferred; the cron never captures them.
- Missing-ledger captures are independently fetched after listing payments for the stored gateway order. Only a single captured, unrefunded payment with exact payment/order IDs, amount and currency reaches the existing atomic finalizer. Multiple captures, refunds, incomplete/mismatched data and permanent failures require review; transient failures queue durable recovery.
- **No RDS recovery path requests a refund automatically.** F7 browser/webhook recovery now queues instead of refunding after an ambiguous finalization error. The cron retries verified finalization or reconciles a matching existing refund; uncertain/failed refunds require reviewed operator action. Successful ledger recovery/already-paid ambiguous entries remain in manual review for explicit closure because the existing refund ledger has no separate resolved-paid status. This is a deliberate conservative policy, not a claim that a refund was sent.
- Finalization rejects recorded refunds; shared provider checks reject wrong payment IDs and partially refunded payments. Recovery claims check authoritative order amount/currency and reject duplicate payment actions attached to another order. Ownership predicates, signatures/HMAC, JPY whole-yen subunits, coupons and atomic functions are preserved.
- Refund webhooks require the stored refund ID and matching payment ID when supplied; delayed failure cannot downgrade refunded entries. Webhook completion compares an exact unexpired timestamp generation, fencing stale handlers after reclaim. Failed capture events are compensated by fresh provider discovery; stored payloads are not replayed by bypassing signature/payment checks.
- Ledger completions compare unexpired lease and attempt generation, retaining PostgreSQL microseconds as text. Expired last-attempt claims escalate to manual review rather than becoming silently stranded. Provider read waits are bounded at four seconds. Discovery/recovery stop starting work after 15/35 seconds; unused leases defer safely and restore unconsumed recovery attempts. Deployed DB/SMTP latency still needs timeout/load validation against the 60-second route budget.
- Aggregate logs/responses report discovered/finalized/expired/deferred/exhausted work and review/stale-webhook backlog. Lost leases and persistence failures return 503. Captured-payment messages no longer falsely promise that a refund started or that support was notified.

## SQL and data safety

**No database migration or pgAdmin action is required.** Existing columns, RLS, scoped app grants and installed business functions suffice. No new function/grant/schema change is proposed, so no forward/rollback package is needed.

Real tests enforce `hod_f7_test` before connecting and with `current_database()` before each transaction, nonprivileged `hod_app`, strict CA/hostname TLS, and explicit provider/SMTP mocks. Most writes roll back. Committed concurrency fixtures use `F8_SYNTHETIC:<uuid>` notes and synthetic provider IDs and are retained rather than deleting existing data. PostgreSQL order-number generators may advance during fixture creation.

Fresh clone metadata scan found **15 tagged F8 orders, 6 related recovery entries and 2 synthetic webhook events** after all test runs. The final full run added four tagged orders and one event; earlier runs account for the remaining fixtures. These are isolated test data, not actual charges/refunds, and must not be copied into staging.

Before/after hashes and counts verified all pre-existing application-visible rows in orders, items, coupons, products, checkout attempts, recovery actions, webhook events and order history unchanged. This covers all 183 existing products/stock and the existing coupon counter. Each made-to-order creation also returned zero active reservations through the existing release function. Protected inventory tables remain inaccessible to the app; no convenience grant was added.

## Verification results

| Check | Result |
| --- | --- |
| Typecheck | PASS, also during production build. |
| Production build | PASS, all 72 static pages, read-only clone and process-only disabled flags with strict TLS. |
| F7 mocked checkout/payment | PASS, 28/28; recovery explicitly asserts no refund request. |
| F8 mocked reconciliation | PASS, 42/42. |
| F8 real SQL | PASS, 16/16 in one clean sequential run; focused follow-up also passed conflicting recovery order/amount checks. |
| Payment subunits / DB foundation | PASS, 7/7 and 3/3. |
| Focused lint | PASS. |
| Full lint | Baseline 30 errors / 167 warnings; no substantive file/rule/message/severity changes after ignoring shifted lines. |
| Clone read-only contract | PASS: four exact signatures, definitions, ownership/search path, existing app execution and no PUBLIC/anon/authenticated execution. |

Real SQL exercises JPY/USD rejection/finalization, payment-ID mismatch, guest ownership, made-to-order stock/reservation non-effects, legacy discovery exclusion, gift/coupon exactly-once usage, cancellation/failure, expiry/late capture, missing-ledger recovery, repeated full cron runs, queued recovery, stale/microsecond leases, exhaustion, cancel/expiry/finalization overlap, recovery during committed finalization, overlapping workers and webhook duplicate/reclaim fencing.

An initial build failed against the unavailable saved tunnel; the strict read-only clone retry passed. A shared build-lock conflict was waited out. An intermediate hash comparison caught overlapping test runs; the clean sequential run and final focused preservation check passed. The known invalid local Fixer key still causes display fallback warnings; non-USD charging remains gated on live rates.

## Exact files changed in this F8 work

```text
app/api/cron/payment-reconciliation/route.ts
lib/f8-prepared.ts                                new
lib/f8-reconciliation.ts                          new
lib/f7-payment.ts                                queued recovery replaces immediate refund
lib/f7-checkout-handlers.ts                       accurate captured-payment messages
lib/f7-webhook-handler.ts                        generation-bound completion
lib/razorpay.ts                                  payment ID/refunded-amount checks
lib/repositories/reconciliation-repository.ts     new
lib/repositories/payment-repository.ts            refund/claim/finalization fencing
scripts/test-f8-reconciliation.mjs                new
scripts/test-f8-sql.mjs                           new
scripts/test-f8-contract.mjs                      new, read-only
scripts/build-f8-readonly.mjs                     new, read-only clone build
scripts/test-f7-checkout.mjs                      updated recovery/provider checks
package.json                                     F8 test commands only
docs/aws-f8-status.md
docs/aws-f8-implementation-report.md              new
docs/AWS_MIGRATION_CURRENT_STATUS.md
docs/aws-f7-f8-work-plan.md
docs/aws-f7-implementation-report.md              follow-up cross-reference
```

Pre-existing dirty changes were preserved. Admin/Keycloak, F3 media, migrations, RDS/TLS settings, saved ENVs/dependencies and placement guards were untouched. The original wiring plan contains invalid UTF-8 bytes and was left unchanged; this report supersedes its historical F8-not-started wording.

## Remaining release dependencies

1. Actual Razorpay **test-mode UAT**: callback/webhook retries, late capture, refund/provider response shapes and exact payment checks. Exercise operator review/refund and successful recovery closure; automatic refunds are intentionally disabled.
2. Deployed AWS scheduler/observability: endpoint/secret delivery, cadence and batch throughput, DB/provider/SMTP timeout/lease behavior under load, monitoring delivery and operator ownership. Vercel's old payment schedule remains `5 * * * *`; no AWS scheduler or notification system was provisioned.
3. Wider F7 release approval: configured customer-auth/payment flows and required live FX/email/Redis/deployment checks. This report does not approve F7 or open checkout.

**Next action: controlled deployed UAT/release verification. No local SQL action is needed. Do not activate flags, relax checkout guards or deploy based only on these local checks.**
