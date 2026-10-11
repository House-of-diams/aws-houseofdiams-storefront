# House of Diams — Project Documentation

> AWS runtime update (2026-10-11): the storefront now reads from RDS, resolves owned media through CloudFront/S3, and uses the guarded Keycloak customer-auth/RDS payment implementation. Supabase SDKs and runtime ENV dependencies have been removed. The older provider/auth sections below are historical; use [the current AWS status](docs/AWS_MIGRATION_CURRENT_STATUS.md), [F9 report](docs/aws-f9-implementation-report.md) and [DevOps handoff](docs/AWS_UAT_DEPLOYMENT_HANDOFF.md) for deployment decisions. Production cutover remains pending UAT.

## Project overview

House of Diams is a luxury diamond-jewellery storefront. It supports product discovery, configurable product pages, a persistent shopping bag, coupons and free gifts, guest and authenticated checkout, Razorpay payments, customer accounts, editorial content, bespoke enquiries, promotions, and CMS-backed marketing sections.

This document records the earlier storefront architecture at:

    D:\Main Hod\house-of-diams

It documents the implementation that exists today and identifies the areas that should be extended for larger production traffic.

## Technology stack

### Application

- Next.js 16.2.4 with the App Router.
- React 19.2.4 and React DOM 19.2.4.
- TypeScript 5.
- Tailwind CSS 4 through PostCSS.
- ESLint 9 with the Next.js configuration.
- Node.js server runtime for API routes and server-side data loading.

### Interface

- React client components for interactive experiences.
- Tailwind utilities and design tokens in app/globals.css.
- Radix Select for accessible select controls.
- Lucide React and MUI icons.
- GSAP and Lenis for selected animation and scrolling experiences.
- next/font and local fonts in app/fonts.ts.

### Data and integrations

- Supabase PostgreSQL, Auth, Row Level Security, and Storage.
- Razorpay payment checkout, verification, webhooks, and reconciliation.
- Redis-aware rate limiting for multi-instance deployments.
- Nodemailer for email delivery.
- Google Analytics and Google Tag Manager.
- Vercel deployment configuration.

## Architecture

The application uses the Next.js App Router. Server components and server data loaders handle initial page data, while client components handle cart state, product configuration, modals, account forms, checkout interaction, and responsive UI.

Important boundaries:

- app/ contains routes, layouts, API handlers, metadata, and global styles.
- components/ contains reusable and feature-specific UI.
- lib/ contains business logic, data access, validation, pricing, payments, caching, SEO, and browser stores.
- context/ contains application-wide providers such as currency.
- supabase/migrations/ contains ordered database changes.
- public/ contains static images, SVGs, videos, and brand assets.
- scripts/ contains project validation and performance checks.

The application layout wires together currency, cart, contact drawer, wishlist, toast, analytics, maintenance mode, navigation, and site chrome providers.

## Customer-facing functionality

### Catalog

- Shop listing, search, sorting, filtering, and category navigation.
- Category, subcategory, and option-based routes.
- Product gallery, description, specifications, FAQs, pricing, trust information, and related products.
- Product configuration for metal/material and other product-specific choices.
- Selection-aware product prices and images.
- Wishlist persistence in the browser.

Catalog normalization and product identity are centralized in lib/catalog-products.ts and lib/product-keys.ts. New product features should continue using these modules instead of comparing product names or display labels.

### Bag and cart

The cart is managed by lib/hooks/useCart.tsx and provided through CartProvider.

Current behavior includes:

- Guest cart persistence in the browser.
- Configuration snapshots for selected products.
- Quantity changes and item removal.
- Coupons and free-gift items.
- Related product recommendations.
- Currency-aware totals.
- A slide-in cart drawer.
- A full /cart page with products, recommendations, coupon input, and order summary.

### Checkout and payments

Checkout is server-authoritative for important values. The browser does not decide the final price, discount, tax, inventory allocation, or payment result.

The checkout system supports:

- Shipping information and postal lookup.
- Server-side product and selection pricing.
- Coupon validation.
- Tax calculation.
- Guest checkout tokens.
- Pending orders and idempotency.
- Inventory reservation and allocation.
- Razorpay checkout and payment verification.
- Webhook processing and reconciliation.
- Payment recovery and failed-payment handling.
- Currency-aware payment summaries.
- Order success and failure pages.

Core modules include lib/checkout-order.ts, lib/checkout-pricing.ts, lib/razorpay.ts, lib/payment-recovery.ts, app/api/checkout/place/route.ts, app/api/payments/verify/route.ts, and app/api/payments/webhook/route.ts.

### Authentication and accounts

Supabase Auth provides email/password and Google authentication.

The sign-up flow validates:

- Email format.
- Username format.
- Strong password requirements.
- Confirm-password matching.

The account area supports:

- Personal names and phone.
- Birth date and anniversary date.
- Default checkout address.
- Order history.
- Password-reset initiation.
- Authenticated profile persistence.

Profile reads and writes are routed through app/api/profile/route.ts. The API verifies the bearer token with Supabase Auth before reading or writing the authenticated user’s profile.

### CMS-backed content

CMS-backed content includes:

- Homepage hero slides and overlay content.
- Navigation and announcement bars.
- Collections and category content.
- Testimonials and testimonial marquee.
- Certifications and service sections.
- Blog and education presentation data.
- About page sections.
- Bespoke page sections.
- Promotion popup questions and offers.
- Instagram Reels.
- Additional summary information.

The storefront reads public content through server loaders or public API routes. Administrative editing is handled by the associated admin application/panel and is outside this storefront repository.

### Forms and communication

The application includes contact, bespoke enquiry, newsletter, promotion, and related forms. Public writes go through server endpoints that validate, sanitize, and rate-limit submissions.

## API organization

- /api/public/* contains public CMS reads, catalog reads, and controlled form submissions.
- /api/profile/* contains authenticated profile and order history operations.
- /api/checkout/* contains pricing, coupon, tax, postal lookup, placement, cancellation, and success operations.
- /api/payments/* contains payment verification and webhook operations.
- /api/cron/* contains scheduled reconciliation and indexing operations.
- /api/health provides a health check.
- /api/csp-report receives Content Security Policy reports.

## Database and migration strategy

Supabase migrations are timestamped and ordered. The current migration history covers:

- Inventory allocation and reservations.
- Secure payment finalization.
- Checkout idempotency.
- Atomic pending-order creation.
- Atomic coupon finalization.
- Free-gift order items.
- Storefront performance indexes.
- Payment recovery and reconciliation.
- Abandoned checkout cleanup.
- Guest checkout.
- Checkout result CMS content.
- Promotion popup questions and options.
- Customer birth and anniversary dates.
- Order status history.
- Secure public-form write boundaries.

Migration rules:

1. Never edit an already-applied migration in place.
2. Add a new timestamped migration for every schema or permission change.
3. Test migrations on staging before production.
4. Confirm indexes and constraints before changing application queries.
5. Keep service-role credentials server-only.
6. Document whether a migration is reversible and what data it affects.

## Security model

Current protections include:

- Bearer-token verification on authenticated APIs.
- Server-only service-role access.
- RLS and permission boundaries for public-form tables.
- Server-side validation and sanitization for public forms.
- Server-authoritative checkout prices and payment verification.
- Guest checkout ownership through a token flow.
- Coupon and order validation on the server.
- Sanitized HTML rendering helpers.
- Allowlisted and validated profile fields.
- Cron-secret protection for scheduled routes.
- CSP reporting and security-header hardening.

Future security requirements:

- Never expose service-role, payment, SMTP, Redis, or cron secrets to browser code.
- Never trust browser-supplied totals, discounts, product prices, or user IDs.
- Validate every API payload independently of client validation.
- Keep RLS policies on user-owned tables even when trusted routes use a service role.
- Keep Razorpay webhook signature verification enabled.
- Configure Redis in production so rate limits are shared across instances.
- Return generic errors to public users rather than raw database errors.
- Add audit logs for catalog, coupon, CMS, promotion, and order administration.

## Scalability assessment

The codebase already has good long-term foundations:

- App Router server/client separation.
- Shared checkout domain modules.
- Centralized product identity and catalog normalization.
- Server-authoritative pricing and payment operations.
- Idempotency and reconciliation migrations.
- Storefront performance indexes.
- Redis-aware rate limiting.
- Deferred and lazy UI sections.
- Performance budget tooling.
- Clear API boundaries for public, authenticated, payment, and scheduled work.

Scale-sensitive areas to monitor:

1. Keep catalog queries indexed, paginated, and filtered in the database.
2. Cache stable CMS content and use revalidation where freshness allows.
3. Move large-catalog search from broad in-memory filtering to indexed search.
4. Use Redis-backed rate limiting in all multi-instance production environments.
5. Use optimized responsive images and lazy loading for media-heavy pages.
6. Preserve checkout transaction, idempotency, inventory, and webhook boundaries.
7. Add auditability for administrative changes.
8. Add structured logs, request IDs, payment correlation IDs, and error monitoring.
9. Move email, indexing, reconciliation, and heavy media processing to durable background jobs as volume grows.
10. Add integration tests for checkout, coupons, inventory, webhooks, auth, profile writes, and public-form permissions.

## Environment configuration

Public/browser-safe variables:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_SUPABASE_COLLECTION_BUCKET
- NEXT_PUBLIC_SITE_URL
- NEXT_PUBLIC_GTM_CONTAINER_ID
- NEXT_PUBLIC_GA_MEASUREMENT_ID

Server-only variables:

- SUPABASE_SERVICE_ROLE_KEY
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- RAZORPAY_WEBHOOK_SECRET
- RAZORPAY_CURRENCY
- REDIS_URL
- CRON_SECRET
- EMAIL_HOST
- EMAIL_PORT
- EMAIL_USER
- EMAIL_PASS
- EMAIL_FROM
- GOOGLE_GEOCODING_KEY
- APILAYER_FIXER_API_KEY or FIXER_API_KEY
- INDEXNOW_KEY

Never commit values for these variables. Use local environment files only for development and deployment-provider secrets for hosted environments.

## Development workflow

Install and run locally:

    npm install
    npm run dev

Validation commands:

    npm run typecheck
    npm run lint
    npm run performance:check

Production build:

    npm run build
    npm start

Before a pull request:

- Run typecheck, lint, and performance checks.
- Test desktop and mobile layouts.
- Test guest and authenticated checkout.
- Test coupons, free gifts, payment success, payment failure, and retry flows.
- Test profile persistence after refresh and a new sign-in.
- Test public forms with valid, invalid, oversized, and repeated submissions.
- Review database migrations separately from application changes.

## Recommended next engineering steps

1. Add automated integration tests for the complete checkout state machine.
2. Add database-level RLS policy tests for profiles, orders, CMS records, and public forms.
3. Add structured error monitoring and payment correlation IDs.
4. Formalize staging deployments and migration approvals.
5. Configure Redis in production and test rate limiting across multiple instances.
6. Replace remaining raw image elements with optimized image handling where beneficial.
7. Consolidate repeated API validation and client patterns into shared utilities.
8. Add admin audit trails for CMS, catalog, coupon, and promotion changes.
9. Perform regular Supabase database and Storage backup/restore drills.
10. Update this document when major features, integrations, migrations, or deployment decisions change.

## Key files

| Purpose | Location |
| --- | --- |
| Root layout and providers | app/layout.tsx |
| Global visual tokens and styles | app/globals.css |
| Catalog domain logic | lib/catalog-products.ts |
| Cart state | lib/hooks/useCart.tsx |
| Checkout order lifecycle | lib/checkout-order.ts |
| Checkout pricing | lib/checkout-pricing.ts |
| Payment integration | lib/razorpay.ts |
| Server Supabase clients | lib/server-supabase.ts |
| Rate limiting | lib/rate-limit.ts |
| Homepage/CMS data | lib/home-data.ts |
| Profile API | app/api/profile/route.ts |
| Checkout placement API | app/api/checkout/place/route.ts |
| Payment webhook | app/api/payments/webhook/route.ts |
| Database migrations | supabase/migrations/ |
| Performance check | scripts/check-performance-budget.mjs |

