-- PROPOSAL ONLY. DO NOT EXECUTE UNTIL REVIEWED WITH DEVOPS.
-- SUPERSEDED by aws-f2-master-forward.sql for the complete remaining F2 review.
-- Do not run both this standalone proposal and the master migration.
-- F2-B navbar read bridge, after F2-A taxonomy migration and verification.
-- Source: supplied staging RDS pg_policies export and current lib/navbar-server.ts.
-- No data changes, auth-schema grant, BYPASSRLS, RLS disable, or function rewrite.
--
-- TEMPORARY STAGING BRIDGE, NOT FINAL KEYCLOAK ADMIN AUTHORIZATION:
-- The existing admin is_admin() policies are narrowed from PUBLIC to the legacy
-- authenticated DB role. DevOps must first verify this preserves current admin
-- access. Replace these policies with the separately designed admin-role or
-- server-side authorization model during admin/Keycloak migration; hod_app must
-- never inherit the admin role. This file does not implement admin migration.
--
-- Existing public SELECT policies: navbar_items, navbar_sections,
-- navbar_section_links: active rows; navbar_section_source_items and
-- navbar_featured_cards: all rows; catalog_metals and catalog_stone_shapes:
-- active rows; catalog_styles: all rows. These remain unchanged.
-- navbar_sections also has a separate admin SELECT policy calling is_admin().
-- catalog_certificates has RLS enabled but NO policy. The current navbar read
-- selects all certificates without a status filter, so only hod_app gets an
-- all-row SELECT policy. Existing admin protections on all other tables stay.
-- navbar_items has one intentional hidden-row read: slug='bespoke' AND
-- status='hidden'. A scoped hod_app SELECT policy preserves that behavior.
-- No broader hidden-row visibility is introduced.

BEGIN;

DO $f2_navbar_preflight$
DECLARE
  expected record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hod_app')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR pg_has_role('hod_app', 'authenticated', 'MEMBER') THEN
    RAISE EXCEPTION 'F2 navbar role state differs from reviewed export';
  END IF;

  FOR expected IN SELECT * FROM (VALUES
    ('navbar_items', 'navbar items admin write', 'navbar items public read', '(status = ''active''::navbar_status)'),
    ('navbar_sections', 'navbar sections admin write', 'navbar sections public read', '(status = ''active''::navbar_status)'),
    ('navbar_section_links', 'navbar section links admin write', 'navbar section links public read', '(status = ''active''::navbar_status)'),
    ('navbar_section_source_items', 'navbar section source items admin write', 'navbar section source items public read', 'true'),
    ('navbar_featured_cards', 'navbar featured cards admin write', 'navbar featured cards public read', 'true'),
    ('catalog_metals', 'catalog metals admin write', 'catalog metals public read', '(status = ''active''::catalog_status)'),
    ('catalog_stone_shapes', 'catalog stone shapes admin write', 'catalog stone shapes public read', '(status = ''active''::catalog_status)'),
    ('catalog_styles', 'catalog styles admin write', 'catalog styles public read', 'true')
  ) AS v(table_name, admin_policy, read_policy, read_qual) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = expected.table_name
        AND c.relkind IN ('r', 'p') AND c.relrowsecurity AND NOT c.relforcerowsecurity
    ) OR NOT has_table_privilege('hod_app', format('public.%I', expected.table_name), 'SELECT') THEN
      RAISE EXCEPTION 'F2 navbar table state or hod_app SELECT changed: %', expected.table_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public'
        AND p.tablename = expected.table_name AND p.policyname = expected.admin_policy
        AND p.cmd = 'ALL' AND p.permissive = 'PERMISSIVE'
        AND p.roles::text = '{public}' AND p.qual = 'is_admin()'
        AND p.with_check = 'is_admin()'
    ) OR NOT EXISTS (
      SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public'
        AND p.tablename = expected.table_name AND p.policyname = expected.read_policy
        AND p.cmd = 'SELECT' AND p.permissive = 'PERMISSIVE'
        AND p.roles::text = '{public}' AND p.qual = expected.read_qual
    ) THEN
      RAISE EXCEPTION 'F2 navbar policies changed: %', expected.table_name;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public'
      AND p.tablename = 'navbar_sections'
      AND p.policyname = 'Admin can read navbar_sections'
      AND p.cmd = 'SELECT' AND p.roles::text = '{public}'
      AND p.qual = 'is_admin()'
  ) THEN
    RAISE EXCEPTION 'F2 navbar_sections extra admin SELECT policy changed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'catalog_certificates'
      AND c.relkind IN ('r', 'p') AND c.relrowsecurity AND NOT c.relforcerowsecurity
  ) OR NOT has_table_privilege('hod_app', 'public.catalog_certificates', 'SELECT')
     OR EXISTS (
       SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public'
         AND p.tablename = 'catalog_certificates'
     ) THEN
    RAISE EXCEPTION 'F2 catalog_certificates RLS/grant/policy state changed';
  END IF;
END $f2_navbar_preflight$;

ALTER POLICY "navbar items admin write" ON public.navbar_items TO authenticated;
ALTER POLICY "navbar sections admin write" ON public.navbar_sections TO authenticated;
ALTER POLICY "Admin can read navbar_sections" ON public.navbar_sections TO authenticated;
ALTER POLICY "navbar section links admin write" ON public.navbar_section_links TO authenticated;
ALTER POLICY "navbar section source items admin write" ON public.navbar_section_source_items TO authenticated;
ALTER POLICY "navbar featured cards admin write" ON public.navbar_featured_cards TO authenticated;
ALTER POLICY "catalog metals admin write" ON public.catalog_metals TO authenticated;
ALTER POLICY "catalog stone shapes admin write" ON public.catalog_stone_shapes TO authenticated;
ALTER POLICY "catalog styles admin write" ON public.catalog_styles TO authenticated;

CREATE POLICY hod_app_navbar_hidden_bespoke_read ON public.navbar_items
  FOR SELECT TO hod_app USING (slug = 'bespoke' AND status = 'hidden'::navbar_status);
CREATE POLICY hod_app_catalog_certificates_read ON public.catalog_certificates
  FOR SELECT TO hod_app USING (true);

COMMIT;

-- VERIFICATION (run separately, read-only, after DevOps review):
-- SELECT tablename, policyname, roles, cmd, qual, with_check FROM pg_policies
-- WHERE schemaname = 'public' AND tablename IN
-- ('navbar_items','navbar_sections','navbar_section_links',
--  'navbar_section_source_items','navbar_featured_cards','catalog_metals',
--  'catalog_stone_shapes','catalog_styles','catalog_certificates')
-- ORDER BY tablename, policyname;
-- With hod_app in a separate READ ONLY transaction, SELECT the active rows
-- required by lib/navbar-server.ts from all nine tables; check the bespoke
-- hidden-row read and verify other hidden navbar_items remain invisible.
-- Compare the rendered navbar/mega-menu output against the pre-migration app.
-- Confirm admin CRUD remains functional under its current role before enabling
-- any RDS navbar code. If any grant/policy check fails, do not enable it.

/* EXACT ROLLBACK (review and run separately; does not remove any data)
BEGIN;
DROP POLICY hod_app_navbar_hidden_bespoke_read ON public.navbar_items;
DROP POLICY hod_app_catalog_certificates_read ON public.catalog_certificates;
ALTER POLICY "navbar items admin write" ON public.navbar_items TO PUBLIC;
ALTER POLICY "navbar sections admin write" ON public.navbar_sections TO PUBLIC;
ALTER POLICY "Admin can read navbar_sections" ON public.navbar_sections TO PUBLIC;
ALTER POLICY "navbar section links admin write" ON public.navbar_section_links TO PUBLIC;
ALTER POLICY "navbar section source items admin write" ON public.navbar_section_source_items TO PUBLIC;
ALTER POLICY "navbar featured cards admin write" ON public.navbar_featured_cards TO PUBLIC;
ALTER POLICY "catalog metals admin write" ON public.catalog_metals TO PUBLIC;
ALTER POLICY "catalog stone shapes admin write" ON public.catalog_stone_shapes TO PUBLIC;
ALTER POLICY "catalog styles admin write" ON public.catalog_styles TO PUBLIC;
COMMIT;
*/
