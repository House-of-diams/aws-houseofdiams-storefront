# F7 controlled execution sequence — review proposal

Updated 2026-10-11. The identity-reference grant, customer-ownership, made-to-order, JPY, and order-history forward migrations were applied by the user to staging; do **not** rerun them. Read-only checks confirmed the fulfillment column/constraint, zero orders, six made-to-order function changes, JPY-versus-other-currency amount branches, the RLS-protected order-history table/trigger, and all 15 scoped function ACLs. The two ordinary stock trigger functions retain their pre-existing broader EXECUTE grants, as permitted by the made-to-order migration guard. No file authorizes production use or checkout activation. The F6 customer-auth and F7 read-preview flags are unset; the F6 checkout guard remains in place.

## Before any forward SQL

1. The identity-reference grant and customer-ownership forward are already applied in staging. Their former preflight, `scripts/test-f7-sql-preflight.mjs`, expects ownership columns to be absent and is **not** a post-migration check; do not rerun either forward file. Consult `aws-f7-status.md` for the verified state. Never use `hod_app` for DDL.
2. Before each remaining forward file, run its current-phase read-only preflight/verification against the actual staging schema and recheck the restricted function ACLs. Stop on any changed column, trigger, function definition/owner/ACL, role privilege, or unexpected commerce row. Do not replay the original ownership preflight as though the database were unmigrated.
3. Review the four forward/rollback pairs together. The made-to-order functions must skip physical stock checks, reservations, decrements, and restoration only for new `orders.fulfillment_mode='made_to_order'`; legacy/admin orders retain the default `legacy_stock`. The Keycloak path must store a server-verified `customer_identities.id` in a separate column, never in `user_id`. Guest hash ownership and idempotency uniqueness remain separate. Review the JPY amount factor and all other amount/currency/order/captured-state checks.
4. The ownership file may be applied first in staging behind OFF-by-default gates to establish its schema for code and behavior tests. Review the remaining write-path design and unit tests before approving the made-to-order, JPY, and history files. No assistant-run privileged or mutating SQL is authorized. Do not activate the F7 write gate or relax the F6 proxy guard while any test remains unverified. A real Razorpay capture is not a substitute for isolated regression tests.

## Staging SQL order, with a separate gate for each file

Each file has its own transaction and guard. The assistant has not run these files. Ownership, made-to-order, JPY, and order history are **already applied and read-only verified** in staging; do not rerun them. The next F7 work is code migration and isolated behavior testing, not another reviewed forward file.

1. `aws-f7-customer-ownership-forward.sql` — adds customer owner columns/index/constraints, narrows direct `hod_app` grants, adds required RLS, and retains legacy admin/profile FKs. It now also adds `hod_app` read policies for checkout result CMS tables, which currently have grants but only `anon`/`authenticated` RLS policies.
2. `aws-f7-made-to-order-forward.sql` — adds explicit fulfillment mode and scopes inventory-trigger/finalizer changes to that mode.
3. `aws-f7-jpy-subunits-forward.sql` — fixes the audited JPY subunit expression in the existing finalizer.
4. `aws-f7-order-history-forward.sql` — adds status history, trigger, backfill, and read access. The success route should query existing `catalog_categories` instead of absent `categories`.

After each forward file, run its matching `*-verify.sql` read-only as `hod_app`; after all four, rerun `aws-f7-function-acl-verify.sql` and confirm every callable function still has the scoped ACL. `CREATE OR REPLACE FUNCTION` must not reopen `PUBLIC` execution. Check admin/manual insert behavior and audit history in an isolated test database before live checkout. No SQL file alone enables F7.

## Required behavioral gate before checkout activation

- Guest and Keycloak customer: valid owner, wrong owner, missing owner, duplicate idempotency key, retry after failed attempt, and no cross-customer order read/cancel/verify/success access.
- RDS-only price, variant, GST, quantity, coupon usage limit, discount, free gift, and active/inactive product checks. Current made-to-order items, including gifts with zero physical stock, must remain purchasable; admin/manual legacy-stock behavior must remain unchanged.
- Razorpay order creation, signature rejection, captured-state/order-ID/amount/currency matching (including JPY), duplicate paid finalization, duplicate webhook event, payment failure, cancellation, pending expiry, coupon redemption exactly once, and captured-payment recovery/refund durability.
- No stock reservation, deduction, or restoration for a made-to-order order; retain inventory and adjustment history for legacy orders. Confirm order-status history and checkout success response shape.
- Keycloak password and Google UAT flows, session expiry/logout, customer profile, and checkout ownership. Keep the F6 guard until these and payment regressions pass.

## Rollback boundary

If no F7 customer-owned or made-to-order commerce rows and no order-history rows exist, review rollback in reverse: `aws-f7-order-history-rollback.sql`, `aws-f7-jpy-subunits-rollback.sql`, `aws-f7-made-to-order-rollback.sql`, then `aws-f7-customer-ownership-rollback.sql`. The ownership, fulfillment, and history rollbacks deliberately refuse to discard live customer/order/audit state. Once an F7 order exists, recovery requires a forward repair, not a destructive rollback. Never roll back the already-applied ACL package as part of this sequence.

## Current stop point (updated after local implementation)

The guarded RDS checkout/payment transport is now implemented locally. Typecheck/build, 28 mocked F7 regressions, read-only live contract checks, and 14 production HTTP guard/read checks pass; full lint matches the existing baseline. The database mutation/concurrency/inventory behavior and Keycloak/Razorpay UAT are still unverified. Read [the implementation report](./aws-f7-implementation-report.md), keep saved flags OFF and the F6 placement guard, and provision an isolated test database. F7 is incomplete; F8 is not safe to start.
