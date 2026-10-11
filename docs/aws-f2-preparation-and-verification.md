# F2 preparation and activation gates

F2 is **not complete**. F2-A taxonomy and the revised F2 master RLS migration
were applied and verified by the user. Do not rerun either forward SQL file.
The remaining read-side RLS changes are now consolidated in
`aws-f2-master-forward.sql`, with `aws-f2-master-rollback.sql`,
`aws-f2-master-verify.sql`, and `aws-f2-master-rls-review.md` for review.
The earlier standalone navbar and testimonial SQL files are superseded; do not
apply them in addition to the master. The user reports the master was applied
and verified. Existing taxonomy/navbar reads are locally enabled; product,
CMS, editorial, support, settings, about, bespoke, and other public CMS reads
remain default-off until their output parity checks pass. Do not put any F2 flag
in a `NEXT_PUBLIC_` variable.

## Current database state

The user reports that F2-A taxonomy and the revised F2 master RLS migration
were applied and verified. The read-only verification transaction was rolled
back; the applied policy migration was not rolled back. Do not execute the
master forward SQL or its superseded navbar/testimonial proposals again.

Code migration, per-slice output parity, and carefully selected local flag
activation are still required. The master migration alone does not switch
storefront reads from Supabase or complete F2.

The `authenticated` role in these proposals is a **temporary staging bridge**,
not the final AWS admin authorization model. Before the admin/Keycloak cutover,
replace it through a separately reviewed admin-role/server-side authorization
design. Never grant `hod_app` access to `auth`, admin-role membership, or
`BYPASSRLS`.

## Required review before enabling each slice

- Confirm the current RDS tables, selected columns/types, RLS state, policies,
  role membership, and `hod_app` SELECT grants against the reviewed SQL.
- In a read-only `hod_app` session, execute the exact parameterized read queries
  and compare row shape/visible output with the old Supabase path. For the
  taxonomy slice, test existing and missing slugs at every level, including
  inactive slugs. No writes or privileged SQL are part of app verification.
- Compare cached and uncached responses, sorting/order, links, 404 behavior,
  and navbar/mega-menu output before and after any flag change. Check browser
  network output and built client bundles for credential leakage.
- Run `pnpm typecheck`, `pnpm lint`, `pnpm build`,
  `pnpm test:payment-subunits`, `pnpm test:db-foundation`, and
  `node --test scripts/test-f2-preparation.mjs`. Compare lint to the F0 baseline
  (30 errors, 119 warnings); do not treat that baseline as a pass.
- Roll back the flag first if route parity or errors fail; coordinate any DB
  rollback with DevOps. Do not start F3 or any F7 write-path migration here.

Missing `public.categories` and `public.order_status_history` are F7 checkout
blockers only; neither is used by the prepared F2 taxonomy read path.

## Read-only RDS evidence collected for these slices

The existing local tunnel was reused. A `BEGIN READ ONLY`/`ROLLBACK` metadata
inspection confirmed all 12 taxonomy/navbar tables exist with the selected
columns and expected `catalog_status`/`navbar_status` enums; the nine relevant
taxonomy/navbar FKs were present. All 12 have `hod_app` SELECT grants and RLS
enabled; certificates have zero policies. It separately confirmed both
testimonial tables exist, have `hod_app` SELECT and RLS enabled with zero
policies, use `bigint` IDs, and have the expected items-to-marquee FK. This is
schema evidence only: it did not prove any current `hod_app` data read can pass
RLS, and it made no writes or policy changes.
