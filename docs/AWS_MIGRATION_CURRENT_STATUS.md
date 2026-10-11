# HOD storefront AWS migration — current handoff

Updated 2026-10-11. Read the [original wiring plan](./HOD_STOREFRONT_AWS_WIRING_PLAN.md) first, then this status. The plan is a historical baseline, not an instruction to replay completed phases or SQL. Re-scan the current branch before acting. Never copy real ENV values into these documents.

## Architecture changes since the original plan

- Staging uses the direct private RDS endpoint and dedicated `hod_app` role, not RDS Proxy. Local development uses the SSM tunnel with TLS CA and expected-host verification.
- Existing shared Redis integration remains compatible with the approved Upstash service. An AWS Redis endpoint with password auth is also supported; no Redis infrastructure was provisioned or changed.
- The original guest-only F6 assumption is superseded: customer login/signup and Google are required for the first AWS release. F6 uses the separate `hod-customers` realm and remains a disabled preview pending SQL/UAT and F7 commerce ownership. See `aws-f6-customer-auth.md`. Admin/Keycloak remains separate.
- `media.houseofdiams.com` serves storefront media through CloudFront and private S3 bucket `house-of-diams`. `content.houseofdiams.com` fronts a different private HOD-content bucket; no separate content-CDN ENV is currently wired in the storefront. Do not assume this domain is unnecessary for every other consumer.
- F9 removed storefront Supabase/R2 runtime ENV reads, SDK imports and dependencies locally. The old saved local ENV is unchanged; the AWS handoff omits those credentials. S3/CloudFront serving does not require AWS access keys in the storefront.

## Phase state

| Phase | Current state | Next gate |
| --- | --- | --- |
| F0 baseline | Completed earlier; known lint baseline recorded. | Do not repeat dependency restructuring. |
| F1 PostgreSQL foundation | Implemented and manually verified: `/api/readiness/db` returned HTTP 200 with `database: ready`; shallow health stayed separate. | Recheck in deployment. |
| F2 read-only storefront | RDS readers and the user-applied F2-A/master/summary policies were prepared earlier. F9 now makes these RDS paths mandatory and removes the legacy fallback/transport switches. | No production deployment or final full regression. See `aws-f2-execution-plan.md`; maintenance remains intentionally `true` per latest user choice. Payment/auth transport has subsequently been prepared through F6-F9 and remains gated pending UAT. |
| F3 media | Storefront URL resolver and CDN configuration implemented. 2,878 missing assets copied without overwriting existing S3 keys. Audit found 5,017/5,019 actual referenced media objects; user explicitly accepted the two missing SVG icons as unimportant. Local storefront/admin builds passed and local Home/About/Bespoke rendered CDN URLs. | Not a deployed/live sign-off: verify UAT routes, all required image/video paths, and an authenticated admin image and video upload under the deployed IAM identity. See `aws-f3-media-status.md`. |
| F4 AWS headers/proxy | Implemented and verified locally; no deployment. | Deployed infrastructure verification remains. See `aws-f4-status.md`. |
| F5 public form writes | Implemented and verified locally through RDS as `hod_app`; user applied revised INSERT policies. | 136 distinct functional cases and original API status/JSON parity passed in local production HTTP tests. No deployment; shared Redis remains unverified because local `REDIS_URL` is unset. See `aws-f5-status.md`. |
| F6 customer auth | Disabled Keycloak identity/profile preview implemented; user applied the staging identity SQL and read-only metadata verification confirmed the three RLS tables plus `hod_app` grants/policies. Local F6 tests, typecheck, build, and payment/DB checks pass; lint matches baseline. | Configure `hod-storefront`/Google and complete UAT auth flows; F7 must migrate account checkout ownership before release. See `aws-f6-customer-auth.md`. |
| F7 checkout/payment | Guarded RDS checkout/payment/recovery/success/history transport implemented locally; all applied SQL rechecked read-only. Saved flags OFF and F6 placement guard retained. Typecheck/build, 28 focused tests, and 14 production HTTP guard/read checks pass; lint remains 30 errors/167 warnings. | Isolated SQL mutation/concurrency/inventory tests and F6/Razorpay UAT remain. F7 is incomplete; F8 activation remains blocked. A preparation-only F8 exception is documented below. See `aws-f7-implementation-report.md`. |
| F8 reconciliation cron | Locally implemented with flags OFF; 42 mocked and 16 real isolated SQL tests pass. Made-to-order expiry/discovery, durable no-auto-refund recovery and lease fencing are prepared. No migration needed. See `aws-f8-status.md`. | Actual Razorpay test-mode UAT, deployed scheduler/secret/timeouts/monitoring/operator review and wider F7 release approval. No activation/deployment. |
| F9 provider removal | Implemented locally under the user's 2026-10-11 authorization. Runtime SDK/imports and old-provider ENV reads are removed; RDS and CloudFront are the storefront data/media paths. | Local verification is recorded in `aws-f9-implementation-report.md`; deployed UAT remains. The user confirmed the older Diamond Info/Hip Hop hero sections are unused: retain empty/default behavior without adding read policies. |
| F10 full cutover regression | Not started. | Full staging/production-safety gate. |

## Where data and media come from

- Catalog/CMS metadata, taxonomy, checkout pricing and profile/order reads now use RDS directly. F2 transport switches are removed. F5 submissions already use RDS; customer authentication and payment/reconciliation mutations remain disabled by their release gates.
- `lib/media-url.ts` resolves owned media keys and legacy Supabase/R2 public URLs to `https://media.houseofdiams.com/...` when `NEXT_PUBLIC_MEDIA_CDN_BASE_URL` is set. CloudFront fetches the object from private S3. Intentionally external URLs remain external.
- The storefront ENV package no longer requires Supabase or R2 credentials. Admin is a separate project; its preview/upload configuration was not changed. Public historical hostnames remain only as an offline URL-to-CDN translation registry.
- Neither storefront nor admin changes in this handoff are confirmed deployed. Local checks do not establish what the live website currently serves.

## Immediate guardrails

- **Do not mark the storefront migration complete or cut over production yet.** F7 payment UAT, F8 deployed reconciliation verification, F9 deployed provider verification, and F10 full regression remain; F6 UAT verification and earlier deployment checks also remain. Admin migration may be audited and planned in parallel, but it is a separate project and cannot substitute for these storefront gates.

- Saved `.env.local` was left intact. Do not supply old-provider credentials to the AWS storefront build/runtime. Use the updated UAT template and private handoff.
- Do not rerun the already-applied F2-A/master RLS SQL. Do not use the RDS master user for storefront runtime.
- Do not claim F3 fully verified on UAT until deployed media and upload checks pass; the two missing SVGs are a documented, user-accepted exception.
- The user authorized local F9 implementation on 2026-10-11. Production push/deployment, external configuration and SQL mutations remain separate actions.
