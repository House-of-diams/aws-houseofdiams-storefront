# Supabase request-volume audit before AWS UAT

Updated 2026-10-11. Reported ~50,000 Supabase requests/day equals ~35 requests/minute. **The exact source is not proven** because no Supabase edge/API/auth/storage request logs, timestamps, user agents or IP breakdown were supplied. A database row count or one developer account cannot establish request volume: bots, crawlers, preview/prefetch, admin API calls, failed retries, auth refresh and storage fetches can all contribute. Do not assert a single root cause from the total alone.

## What the current code does show

- The legacy server transport can fan out one page/data load into many Supabase REST calls. `lib/navbar-server.ts` prepares 11 parallel table reads for the mega menu; `app/bespoke/page.tsx` prepares 12 read calls; `lib/catalog-products.ts` fetches products plus numerous related catalog tables. Those paths have RDS replacements gated by F2 switches, which are currently `true` locally and should be `true` in UAT.
- `app/layout.tsx` loads maintenance and navigation per request, but current routing/navbar data is cached. `lib/navbar-server.ts` and cached product cards/search use 300-second revalidation. This limits repeated backend reads in a warm process; it does not prove what happened on the old deployment or across multiple instances.
- Public UI components make separate API requests for announcement bar, popup, footer, contact, hero/FAQ/stats and products. Some explicitly use browser `cache: 'no-store'`. Before the RDS flags, these endpoints can fan out to Supabase. Navigation prefetch may render pages before a human clicks them.
- Browser Supabase auth is still imported by Navbar/legacy profile. The singleton client has `autoRefreshToken: true`, and legacy auth routes call `getUser()`/`getSession()`. This can produce auth requests, but the current code does **not** show an every-few-seconds Supabase polling loop; observed `setInterval` calls are primarily visual animation. The admin has a Supabase auth gate/profile lookup and several server API/database reads. No evidence yet attributes 50,000/day specifically to admin or storefront.
- Current F2 RDS paths, F5 forms and F7/F8 prepared paths avoid their corresponding Supabase transport when correctly activated. Legacy fallback branches and browser auth remain until F9.

## Evidence needed to identify the actual source

Export a 24-hour request summary from Supabase API/Auth/Storage/Edge logs (metadata only, no tokens or request bodies): count grouped by hour, method, path/endpoint, HTTP status, user-agent and source IP or trusted proxy identifier. Include whether traffic hits REST (`/rest/v1`), Auth (`/auth/v1`), Storage (`/storage/v1`) or functions, and split storefront versus admin if different credentials/headers identify them. Correlate with CDN/ALB access logs and known cron schedules. Redact IPs before sharing outside operations if necessary.

Expected interpretation: repeated `/rest/v1/...` tables suggests fan-out/bots/legacy fallback; repeated `/auth/v1/token` suggests session refresh; `/storage/v1/object` suggests media still loading from Supabase; concentrated user agents/IPs suggest automation. A 5-minute warm-cache request trace of Home, Shop, one product and admin dashboard in UAT should then show zero unexpected Supabase calls on the activated RDS read paths. Do not solve this by removing credentials while legacy routes still use them.

## Before UAT launch

Protect non-public UAT access, enable CloudFront/ALB request logging and sampled application outbound-request metrics by destination/path (never log Authorization headers, cookies, URLs containing keys or request bodies). Apply sensible bot/WAF controls and page/API caching, then compare per-hour Supabase and RDS request counts. Keep checkout disabled until the F6/F7/F8 UAT gate passes.
