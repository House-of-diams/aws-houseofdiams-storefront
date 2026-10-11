-- PROPOSAL ONLY. Apply once in staging as the table owner after review.
-- Scope: the Additional Summary Details panel on cart and checkout only.
-- Do not rerun the already-applied F2-A or F2 master migrations.
-- No data writes, auth-schema grants, BYPASSRLS, or RLS disable.

BEGIN;

DO $f2_summary_preflight$
DECLARE
  table_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hod_app' AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'hod_app role state changed';
  END IF;
  FOREACH table_name IN ARRAY ARRAY['cms_summary_sections', 'cms_summary_pointers'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = table_name
         AND c.relkind IN ('r', 'p') AND c.relrowsecurity AND NOT c.relforcerowsecurity
    ) THEN
      RAISE EXCEPTION 'Summary table or RLS state changed: %', table_name;
    END IF;
    IF NOT has_table_privilege('hod_app', format('public.%I', table_name), 'SELECT') THEN
      RAISE EXCEPTION 'hod_app SELECT grant changed: %', table_name;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
        AND tablename IN ('cms_summary_sections', 'cms_summary_pointers')) <> 4 THEN
    RAISE EXCEPTION 'Summary policy count changed';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
        AND (tablename, policyname) IN (
          ('cms_summary_sections', 'Summary admin write'),
          ('cms_summary_pointers', 'Summary pointers admin write')
        ) AND permissive = 'PERMISSIVE' AND roles = '{public}'
          AND cmd = 'ALL' AND qual = 'is_admin()' AND with_check = 'is_admin()') <> 2 THEN
    RAISE EXCEPTION 'Summary admin policy state changed';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
        AND (tablename, policyname) IN (
          ('cms_summary_sections', 'Summary public read'),
          ('cms_summary_pointers', 'Summary pointers public read')
        ) AND permissive = 'PERMISSIVE' AND roles = '{public}'
          AND cmd = 'SELECT' AND with_check IS NULL) <> 2 THEN
    RAISE EXCEPTION 'Summary public read policy state changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'cms_summary_sections'
      AND policyname = 'Summary public read' AND qual = 'is_enabled'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'cms_summary_pointers'
      AND policyname = 'Summary pointers public read'
      AND regexp_replace(qual, '[[:space:]]+', ' ', 'g') =
        '(EXISTS ( SELECT 1 FROM cms_summary_sections s WHERE ((s.id = cms_summary_pointers.section_id) AND s.is_enabled)))'
  ) THEN
    RAISE EXCEPTION 'Summary public read predicate changed';
  END IF;
END
$f2_summary_preflight$;

-- The existing public SELECT policies already restrict visibility to enabled
-- sections and their pointers. Narrow admin ALL policies so hod_app does not
-- evaluate is_admin(), which references the inaccessible auth schema.
-- This authenticated-role bridge matches the already-applied F2 master.
ALTER POLICY "Summary admin write" ON public.cms_summary_sections TO authenticated;
ALTER POLICY "Summary pointers admin write" ON public.cms_summary_pointers TO authenticated;

COMMIT;
