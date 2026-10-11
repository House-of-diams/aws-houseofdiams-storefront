# F6 customer authentication status

Updated 2026-10-10. F6 is implemented as a disabled identity preview. The user manually applied the F6 identity SQL to staging RDS and verified the three customer tables, RLS, `hod_app` grants, and policies. Keycloak/UAT end-to-end verification remains outstanding. Customer login/signup and Google are required for the first AWS release; the historical guest-only plan is superseded.

Customer auth uses a separate Keycloak realm (`hod-customers`) and a confidential storefront OIDC client. It uses Authorization Code with PKCE S256, validates the OIDC nonce and RS256 ID-token signature/claims (including verified email), stores only a hash of an opaque session token in RDS, and returns that token in a Secure, HttpOnly, SameSite=Lax host-only cookie. No Google credentials or browser database credentials are used. Session lifetime is capped at the validated ID token expiry and eight hours; no refresh token is retained. Keycloak backchannel session revocation is not yet integrated, so local expiry/logout are the current revocation boundaries.

## Scope and current boundary

Auth endpoints return 404 unless `HOD_CUSTOMER_AUTH_ENABLED=true`. The server passes that gate to login/signup/profile/navigation. The gated UI now uses the new Keycloak endpoints and basic customer profile API; the legacy UI remains available while the gate is off. The OIDC flow stores Keycloak subjects in `customer_identities`, session hashes in `customer_sessions`, and the separate customer profile in `customer_profiles`. Password signup uses `prompt=create` and the realm's hosted registration page. The installed Keycloak version must support that parameter, and realm registration, email verification and SMTP must be configured. See [Keycloak registration documentation](https://www.keycloak.org/docs/latest/server_admin/index.html#_user-registration).

Multiple provider subjects with the same email remain separate until explicit Keycloak account linking is verified. The existing `public.profiles.id` and commerce `user_id` columns still reference `auth.users(id)`. Existing order lookup, checkout, and payment flows still consume Supabase bearer tokens. No FK or legacy profile/admin row is changed by the proposed F6 SQL. New identity IDs are never presented as Supabase tokens. The profile API reads/updates only the identity obtained from the server session; client-supplied identity IDs are ignored.

**Preview safety:** while the new gate is on, `/checkout` displays an unavailable message, and proxy guards return 503 for `/api/checkout/place` and `/api/create-order`. This prevents a preview login from starting orders against the old owner contract. Existing payment verification and webhooks remain reachable for recovery. F7 must deliberately replace those guards after migrating ownership. Keep the flag off for the release until F7 and UAT are complete. Do not create shadow Supabase Auth records or grant access to the `auth` schema.

## Endpoints / exact URL registration

With `HOD_CUSTOMER_AUTH_BASE_URL=https://uat.houseofdiams.com`:

- Keycloak valid redirect URI: `https://uat.houseofdiams.com/api/customer-auth/callback`
- Keycloak valid post-logout redirect URI: `https://uat.houseofdiams.com/`. The app deletes its local RDS session and returns a provider logout URL using `client_id` and `post_logout_redirect_uri`; Keycloak may show a confirmation. Provider failure falls back to this local URL after session deletion.
- Keycloak Web Origins: `https://uat.houseofdiams.com`

Production equivalents, once separately configured:

- `https://houseofdiams.com/api/customer-auth/callback`
- `https://houseofdiams.com/`
- `https://houseofdiams.com`

Issuer for UAT: `https://auth-uat.houseofdiams.com/realms/hod-customers`. Do not use `hod-admin`. Google broker callback already registered by DevOps remains `https://auth-uat.houseofdiams.com/realms/hod-customers/broker/google/endpoint`.

## Runtime configuration (names only)

- `HOD_CUSTOMER_AUTH_ENABLED` — leave unset/false until SQL and UAT prerequisites are satisfied.
- `HOD_CUSTOMER_AUTH_BASE_URL` — UAT or production storefront origin.
- `HOD_CUSTOMER_OIDC_ISSUER` — realm issuer URL.
- `HOD_CUSTOMER_OIDC_CLIENT_ID` — storefront Keycloak client ID.
- `HOD_CUSTOMER_OIDC_CLIENT_SECRET` — confidential client secret; secret manager only.
- `HOD_CUSTOMER_SESSION_SECRET` — random secret of at least 32 bytes; secret manager only.
- Existing `DATABASE_URL` — server-side `hod_app` connection, after reviewed grants are applied.

## Database proposal

The user manually applied the staging identity SQL outside this task. Read-only metadata checks in this task confirmed the three tables, RLS, `hod_app` grants, and expected policies. Do not rerun the SQL files against staging. These files document the applied design and remain useful for review; any other environment requires its own review and application process. The rollback is destructive and remains a proposal. No FKs or rows in legacy tables are altered.

The proposal provides explicit SELECT/INSERT/UPDATE policies for identity/profile tables and SELECT/INSERT/UPDATE/DELETE policies for session storage, scoped only to `hod_app`. These policies trust the server role across customers; ownership is enforced by application queries. Anonymous/browser roles have neither grants nor policies. Migration aborts if `hod_app` is superuser/BYPASSRLS or is the execution role. Review inherited roles/default grants and table ownership in the intended environment. Preflight uses paired PostgreSQL catalog FK columns and never reads `auth.users` data. Rollback uses non-cascading drops, so later FK dependencies prevent unsafe removal.

## Exact dependency inventory and changed files

- New OIDC endpoints: `app/api/customer-auth/{start,callback,session,logout}/route.ts`; config/OIDC/signature helpers: `lib/customer-auth/{config,oidc,security}.ts`.
- New profile endpoint: `app/api/customer-auth/profile/route.ts`; entry/account UI: `components/auth/{CustomerAuthEntry,CustomerAccount}.tsx`.
- Server UI gating: `app/{login,signup,profile}/page.tsx`, `app/layout.tsx`, `components/layout/SiteChrome.tsx`, `components/common/Navbar.tsx`. Legacy `AuthForm`/`ProfileClient` and Supabase ENVs/dependencies are retained.
- F6 preview checkout guards: `app/checkout/page.tsx`, `proxy.ts`. Payment/inventory/idempotency implementations are unchanged.
- Legacy ownership still used in `app/api/profile/{route.ts,orders/route.ts}`, `app/api/checkout/{profile,place,cancel,success}/route.ts`, `app/api/payments/verify/route.ts`, `lib/checkout-order.ts`, `components/checkout/{CheckoutPageClient,CheckoutSuccessClient}.tsx`. Profile APIs resolve Supabase users; checkout/order APIs persist and compare those UUIDs; verify/cancel/success use account UUID or guest-token hash.
- `orders.user_id`, `checkout_attempts.user_id`, `carts.user_id`, `wishlists.user_id`, `coupon_redemptions.user_id` retain their Supabase FKs. Coupon finalization functions copy order ownership into redemption rows. Client cart/wishlist state and its identity transport need F7 review before any persistent ownership is adopted.
- SQL review files: `docs/f6-customer-identity-{preflight,forward,rollback,verify}.sql`. Focused tests: `scripts/test-f6-customer-auth.mjs`.

## UAT remaining before F6 can be called complete

1. DevOps provisions the `hod-storefront` client in `hod-customers` with confidential client auth, Standard Flow, PKCE S256, realm self-registration, the exact UAT redirect URI, post-logout redirect URI, and Web Origin above; retain `hod-admin` independently.
2. Staging identity tables and policies are applied and metadata-verified. Configure the named server-only env values in UAT; keep auth disabled until Keycloak and all runtime values are ready. Review and apply the SQL separately in any other environment.
3. Enable the gate only for an approved UAT identity preview after SQL. Verify email/password registration, Google, navbar, profile ownership and provider logout. F7 must define commerce customer ID transport before account checkout/history works; the preview guards stay until that work is reviewed.
4. Complete UAT tests for password signup/login, Google, state/nonce/PKCE rejection, session persistence/expiry/logout, profile, CSRF/open-redirect protection, and payment/checkout ownership compatibility.

F6 is not complete; F7 checkout/payment was not changed or started here.

Local validation on 2026-10-10: focused F6 tests pass 9/9, including real RSA signatures/tampering, issuer/audience/nonce/expiry/unverified-email rejection, mutation-origin checks, and bounded streamed profile payloads. Payment subunits pass 6/6; DB foundation passes 3/3; typecheck passes. Full lint matches the saved baseline at 30 errors/167 warnings, with no F6-file diagnostics. Production build succeeds, compiles and prerenders all pages; during static generation the exchange-rate lookup warned that its API access key was invalid and used fallback rates. Read-only RDS checks as `hod_app` confirmed the three customer tables with RLS and expected grants/policies, and separately confirmed the existing F2 smoke checks. These checks do not establish deployed Keycloak or browser-flow behavior.
