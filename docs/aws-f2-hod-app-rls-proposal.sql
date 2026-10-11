-- F2-A taxonomy: user reports this migration applied and verified on staging.
-- Historical proposal retained for review; do not re-run it.
-- AWS staging F2-A: minimum taxonomy read bridge for hod_app.
-- Source: 2026-10-07 RDS pg_policies export and current lib/catalog-taxonomy.ts.
-- AFFECTED TABLES ONLY: catalog_categories, catalog_subcategories, catalog_options.
-- No data DML, auth-schema grant, BYPASSRLS, RLS disable, or function rewrite.
--
-- ARCHITECTURE: TEMPORARY STAGING COMPATIBILITY BRIDGE, NOT FINAL AWS ADMIN DESIGN.
-- These existing admin ALL policies currently apply TO PUBLIC and invoke is_admin(),
-- which calls Supabase auth.uid() for hod_app SELECT queries. Narrowing TO authenticated
-- keeps the existing Supabase admin policy expression for the transition and prevents
-- hod_app from evaluating it. It does NOT make authenticated the Keycloak admin role.
-- Before admin/Keycloak cutover, replace the legacy admin policy role/expression in
-- a separately reviewed migration using a dedicated admin DB role or explicit
-- server-side authorization design. Verify admin operations, then remove the
-- authenticated bridge. Never make hod_app a member of that admin role.
--
-- Current policies from RDS export (all RLS enabled, FORCE RLS false):
-- catalog_categories: "catalog categories admin write" ALL TO PUBLIC
--   USING is_admin() WITH CHECK is_admin(); "catalog categories public read"
--   SELECT TO PUBLIC USING (status = 'active'::catalog_status).
-- catalog_subcategories: "catalog subcategories admin write" ALL TO PUBLIC
--   USING is_admin() WITH CHECK is_admin(); "catalog subcategories public read"
--   SELECT TO PUBLIC USING (status = 'active'::catalog_status).
-- catalog_options: "catalog options admin write" ALL TO PUBLIC
--   USING is_admin() WITH CHECK is_admin(); "catalog options public read"
--   SELECT TO PUBLIC USING (status = 'active'::catalog_status).
-- All three are publicly readable taxonomy inputs in the current storefront.
-- No new SELECT policy is needed: the existing public-read policies apply to hod_app.
--
-- REVIEW GATE: DevOps must confirm any current admin caller depending on these
-- policies uses authenticated (or an independently authorized bypassing role).
-- This script intentionally covers only the first F2 taxonomy slice. It does not
-- unblock navbar, products, CMS, or completion of F2.

BEGIN;

DO $f2_taxonomy_preflight$
DECLARE
  expected record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hod_app')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'F2 taxonomy role state differs from reviewed export';
  END IF;
  IF pg_has_role('hod_app', 'authenticated', 'MEMBER') THEN
    RAISE EXCEPTION 'hod_app is a member of authenticated; abort taxonomy bridge';
  END IF;

  FOR expected IN SELECT * FROM (VALUES
    ('catalog_categories', 'catalog categories admin write', 'catalog categories public read'),
    ('catalog_subcategories', 'catalog subcategories admin write', 'catalog subcategories public read'),
    ('catalog_options', 'catalog options admin write', 'catalog options public read')
  ) AS v(table_name, admin_policy, read_policy) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = expected.table_name
        AND c.relkind IN ('r', 'p') AND c.relrowsecurity AND NOT c.relforcerowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS table state changed: %', expected.table_name;
    END IF;
    IF NOT has_table_privilege('hod_app', format('public.%I', expected.table_name), 'SELECT') THEN
      RAISE EXCEPTION 'hod_app lacks SELECT: %', expected.table_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = expected.table_name
        AND p.policyname = expected.admin_policy AND p.cmd = 'ALL'
        AND p.permissive = 'PERMISSIVE' AND p.roles::text = '{public}'
        AND p.qual = 'is_admin()' AND p.with_check = 'is_admin()'
    ) THEN
      RAISE EXCEPTION 'Admin policy changed: %.%', expected.table_name, expected.admin_policy;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = expected.table_name
        AND p.policyname = expected.read_policy AND p.cmd = 'SELECT'
        AND p.permissive = 'PERMISSIVE' AND p.roles::text = '{public}'
        AND p.qual = '(status = ''active''::catalog_status)'
    ) THEN
      RAISE EXCEPTION 'Public-read policy changed: %.%', expected.table_name, expected.read_policy;
    END IF;
  END LOOP;
END $f2_taxonomy_preflight$;

ALTER POLICY "catalog categories admin write" ON public.catalog_categories TO authenticated;
ALTER POLICY "catalog subcategories admin write" ON public.catalog_subcategories TO authenticated;
ALTER POLICY "catalog options admin write" ON public.catalog_options TO authenticated;

COMMIT;

-- READ-ONLY VERIFICATION QUERIES FOR DEVOPS (not executed by this file):
-- SELECT tablename, policyname, roles, cmd, qual, with_check
-- FROM pg_policies WHERE schemaname = 'public'
--   AND tablename IN ('catalog_categories', 'catalog_subcategories', 'catalog_options')
-- ORDER BY tablename, policyname;
-- Expected: the three admin policies still use is_admin() but target authenticated;
-- the three public SELECT policies remain unchanged and target PUBLIC.
-- In a SEPARATE read-only transaction under an authorized reviewer:
-- BEGIN READ ONLY;
-- SET LOCAL ROLE hod_app;
-- SELECT 1 FROM public.catalog_categories LIMIT 1;
-- SELECT 1 FROM public.catalog_subcategories LIMIT 1;
-- SELECT 1 FROM public.catalog_options LIMIT 1;
-- ROLLBACK;
-- Also compare active taxonomy visibility with the current storefront responses.

/* EXACT ROLLBACK (review and run separately; NOT part of forward migration)
BEGIN;
ALTER POLICY "catalog categories admin write" ON public.catalog_categories TO PUBLIC;
ALTER POLICY "catalog subcategories admin write" ON public.catalog_subcategories TO PUBLIC;
ALTER POLICY "catalog options admin write" ON public.catalog_options TO PUBLIC;
COMMIT;
*/
