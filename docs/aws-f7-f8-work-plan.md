# Storefront F7 → F8 working sequence

Updated 2026-10-11. Staging RDS is authoritative. This is a working checklist, not approval to enable checkout or run unreviewed SQL. F6 customer auth and F7 write flags stay OFF; `proxy.ts` continues to block the new customer checkout path. Admin and Keycloak server migration are separate.

## Current verified baseline

- The user applied the scoped F7 function ACL, customer-ownership, and made-to-order migrations in staging. Read-only checks confirmed ownership columns/FKs, `orders.fulfillment_mode`, the six patched functions, zero orders, and restricted execution on the four payment security-definer functions. Do not rerun these forward files.
- The user applied the JPY correction and order-status history in staging; read-only verification confirmed the JPY and non-JPY branches, made-to-order branch, order-history table/trigger/RLS, TLS, and all 15 scoped function permissions. The assistant must not execute privileged SQL.
- Guarded RDS place/cancel/verify/webhook/success/profile-orders/recovery transport is now implemented locally; disabled legacy branches remain intentionally. RDS quote/coupon/tax/profile are selected with the prepared transport. Reconciliation still uses Supabase and remains F8. See `aws-f7-implementation-report.md`; isolated SQL behavior and UAT remain outstanding.

The application slices below are implemented locally behind the OFF-by-default gate. Their release/behavioral gates remain open; do not interpret this checklist as activation approval.

## F7 execution slices

1. **Database contract:** JPY and order-history forwards and postflight metadata checks passed; do not rerun them. No remaining reviewed staging SQL forward is queued for F7. Behavioral payment and ownership tests still need an isolated database and UAT exercise.
2. **Checkout ownership and order placement:** port the server-only place path to parameterized RDS repositories, using the server-verified F6 customer identity or the existing guest token hash, never browser-supplied ownership. Preserve idempotency, RDS-only pricing, coupon and tax logic, Razorpay order creation, failure recovery, and response shape. Explicitly set `fulfillment_mode='made_to_order'` for new storefront orders. Keep the current route blocked until behavioral tests pass.
3. **Payment lifecycle:** port cancel, verify/finalize, failure handling, webhook claim/replay, captured-payment recovery, success page, and customer order history in that order. Preserve all installed atomic PostgreSQL functions; replace transport only. Query `catalog_categories` (not the absent `categories`) on the success page.
4. **Isolated regression:** test guest and Keycloak ownership boundaries, duplicate attempts, retries, failure after Razorpay creation, exact amount/currency/captured-state and HMAC checks including JPY, coupons, made-to-order stock non-effects, legacy/admin stock behavior, webhook duplicates, and recovery. Use an isolated test database for writes; do not create real charges merely to validate code.
5. **F7 gate:** typecheck, baseline-aware lint, production build, payment/DB/focused tests, no secret leakage, UAT login and payment-path exercises. Only after the complete gate passes may the F6/F7 flags and proxy behavior change in a reviewed deployment. A SQL COMMIT alone does not complete F7.

## F8, only after F7 approval

**2026-10-11 preparation-only exception:** explicit user authorization allowed a separate F8 audit/code pass while F7 remains incomplete. See [F8 status](./aws-f8-status.md). Activation still requires F7 approval and the remaining F8 gates; this exception does not open checkout or authorize deployment.

Local F8 implementation now passes 42 mocked and 16 isolated SQL tests, including discovery/expiry, queued recovery without automatic refunds, generation fencing, overlapping claims and row-preservation checks. No migration or pgAdmin action is needed. Deployed provider/scheduler/monitoring and wider release gates remain.

Port `app/api/cron/payment-reconciliation/route.ts` from Supabase RPC transport to the existing RDS functions, retaining the cron authorization and bounded claim/expiry/retry behavior. Test repeated runs, overlapping workers, webhook races, expired pending orders, captured-but-unfinalized payments, refund/recovery durability, and no double finalization. Verify the deployed scheduler and secret configuration. Do not broaden `hod_app` function/table privileges or weaken payment checks to make the cron pass.

## Later release gates

F9 removes Supabase/R2 runtime code and ENVs only after a repository-wide proof that F6–F8 no longer use them. F10 is a full deployed UAT regression and production cutover review. Earlier local F0–F5 checks still need deployment verification. No production-ready claim before these gates.
