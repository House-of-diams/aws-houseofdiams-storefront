# F9 AWS storefront connection cleanup

Implemented locally on 2026-10-11 under the user's authorization. The work plan is [aws-f9-work-plan.md](./aws-f9-work-plan.md). **The code is locally prepared for controlled AWS UAT; production cutover and F10 deployed regression are not complete.**

## Result

Catalog, taxonomy, navigation, CMS, homepage, blogs/education, support/about/bespoke, pricing, profile and order reads use PostgreSQL repositories directly. F2 transport-selection switches and Supabase fallback queries have been removed. Filters, ordering, pagination, response mapping and cache lifetimes were preserved against the previous RDS implementation.

Owned media resolves through the configured CloudFront CDN. A public hostname registry translates historical Supabase/R2 URLs into S3 object keys without any old-provider ENV, SDK or network request. External URLs and bundled assets retain their existing behavior. Image/video helpers no longer bypass this translation for absolute owned URLs. CloudFront image configuration and CSP no longer depend on the old providers.

Remaining Diamond Info, Hip Hop hero and category FAQ readers now use parameterized RDS queries. Profile reads/writes bind to the verified Keycloak cookie identity, preserve validation, and reject cross-origin mutations. Private responses use no-store caching. Profile mutation behavior was tested with persistence mocked; no real customer profile was changed.

Checkout placement, cancellation, verification, webhook, success/history and reconciliation routes use the prepared RDS implementations. The auth/F7/F8 gates remain OFF in the saved ENV, and the checkout release guards remain. Disabled payment routes reject before invoking their handlers. Existing pricing, currency, coupon/gift and payment recovery logic remains covered by the offline tests. Legacy SDK payment/auth implementations, client bearer-session lookups and the SDK dependency were removed. Both tracked lockfiles were updated.

## Verification

| Check | Result and limit |
| --- | --- |
| Offline regression | **117 passed**, zero failures/skips. DB foundation, payment subunits, routing state/headers, auth, checkout, reconciliation, F2 repository/policy contracts and new F9 media/provider/guard/profile/error tests. External persistence/providers were mocked or not loaded. |
| TypeScript | Passed standalone typechecking and the final production build's typechecking. |
| Production build | Passed; 72 static pages generated. Old Supabase/R2/Cloudflare/Vercel ENV settings were blanked in the build process. Every DB session targeted `hod_f7_test` with PostgreSQL enforcing read-only access and strict CA verification. Saved ENV was not edited. |
| Real RDS parity | **29 public API responses + 14 loading functions matched** the pre-change snapshot's RDS paths over **474 SELECT operations**. Homepage, hero, SEO, navbar, blog, education, docs, product detail, pagination, search and discovery were included. Historical owned absolute URLs were normalized to the same CDN representation for comparison. No old-provider calls were permitted by the loader. |
| Populated catalog parity | Repeated the four product comparisons with explicit nonempty product/detail/page assertions: passed over **188 SELECT operations**. This checks populated data, not only empty defaults. |
| Production HTTP | **14 passed** against a loopback Next.js production server with old-provider ENV blanked. RDS readiness/CMS, product hydration/CDN URL, USD quote, tax, OFF payment gates and disabled profile auth checked. Clone commerce row counts were unchanged. |
| Lint | Full lint remains failing: **28 errors / 119 warnings**, compared with **30 errors / 167 warnings** before cleanup. No new error categories/counts were introduced in any retained file. Remaining existing hooks/type issues are not a clean lint release. |
| Credential/build scan | 525 source/document/test/browser-build files checked against ten known secret values/names; no matches. No Supabase client SDK signature found in browser bundles. This is a limited exact-value scan, not a guarantee that every possible secret is absent. |

The final build still reports the previously known invalid Fixer key and display-rate fallback. Non-USD checkout rejects emergency FX fallback; USD HTTP checks do not validate INR or other currency payments.

## DevOps and F10 requirements

- Use [the refreshed deployment handoff](./AWS_UAT_DEPLOYMENT_HANDOFF.md) and [credential-free ENV template](./aws-uat-env.template). The populated testing file is outside Git at `D:\Main Hod\private-devops-handoff\hod-aws-uat.env`. Available testing credentials are included; the **Keycloak client secret and shared Redis URL are missing**. Verify the webhook secret, replace the invalid Fixer key, mount the AWS RDS CA bundle and verify SMTP. No AWS access key is needed for public CloudFront serving.
- RDS and media are AWS services. Razorpay/FX/optional Google integrations remain external business services. Existing shared Redis and SMTP configuration was not provisioned or changed. If all Redis/email infrastructure must also be AWS-hosted, DevOps must supply compatible AWS Redis/SES SMTP credentials; the code supports those connections.
- The user confirmed that the older Diamond Info/Hip Hop hero sections are unused and should retain their existing empty/default behavior. Their four tables have SELECT grants but no applicable storefront read policies in the checked clone. No new policies are required for this migration; these unused sections are not a UAT blocker. No SQL was applied.
- F10 still needs deployed browser/content/media checks, agreed maintenance-state handling, Keycloak password/Google/verification/reset/logout tests, Razorpay test-mode capture/webhook/replay/recovery cases, form/email/Redis tests, AWS scheduler and monitoring/operator verification, and checkout release review. The two previously accepted missing SVG objects remain an earlier media exception.

No code was pushed or deployed. The old live repository remote was previously removed; only `https://github.com/dhruval12098/aws-houseofdiams-storefront.git` is configured. The populated ENV remains outside that public repository. No live site, separate admin, external provider configuration, actual payment/refund, saved local ENV or database content was changed.
