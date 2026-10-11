-- PROPOSAL ONLY: user/DBA executes in staging as hod_migration after review.
-- No data changes, grants, auth-schema access, RLS disable, or BYPASSRLS.
-- Server validation and rate limits remain mandatory. The response policy
-- preserves the existing active-promotion database rule for hod_app.
BEGIN;

DO $f5_preflight$
DECLARE
  relation_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hod_app'
    AND NOT rolsuper AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'hod_app role state changed';
  END IF;
  IF current_user <> 'hod_migration' THEN
    RAISE EXCEPTION 'Run as the inspected table owner hod_migration';
  END IF;
  FOREACH relation_name IN ARRAY ARRAY[
    'newsletter_submissions', 'promotion_popup_responses', 'promotion_popup_submissions'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = relation_name AND c.relkind = 'r'
        AND pg_get_userbyid(c.relowner) = 'hod_migration'
        AND c.relrowsecurity AND NOT c.relforcerowsecurity) THEN
      RAISE EXCEPTION 'Table ownership/RLS changed: %', relation_name;
    END IF;
    IF NOT has_table_privilege('hod_app', format('public.%I', relation_name), 'INSERT') THEN
      RAISE EXCEPTION 'Existing INSERT grant changed: %', relation_name;
    END IF;
  END LOOP;
  IF NOT has_table_privilege('hod_app', 'public.promotion_popup', 'SELECT') THEN
    RAISE EXCEPTION 'hod_app cannot read promotion_popup for response policy';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename IN ('newsletter_submissions', 'promotion_popup_submissions')) THEN
    RAISE EXCEPTION 'Expected no existing newsletter/submission policies';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'promotion_popup_responses') <> 1 OR NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'promotion_popup_responses'
      AND policyname = 'Public can submit promotion responses'
      AND permissive = 'PERMISSIVE' AND roles = ARRAY['anon', 'authenticated']::name[]
      AND cmd = 'INSERT' AND qual IS NULL
      AND regexp_replace(with_check, '[[:space:]]+', ' ', 'g') =
        '(EXISTS ( SELECT 1 FROM promotion_popup p WHERE ((p.id = promotion_popup_responses.promotion_id) AND (p.is_active = true))))'
  ) THEN
    RAISE EXCEPTION 'Existing response policy changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')
    AND pg_has_role('hod_app', oid, 'MEMBER')) THEN
    RAISE EXCEPTION 'hod_app inherited role membership changed';
  END IF;
END
$f5_preflight$;

CREATE POLICY hod_app_f5_newsletter_insert ON public.newsletter_submissions
  FOR INSERT TO hod_app WITH CHECK (true);
CREATE POLICY hod_app_f5_promotion_response_insert ON public.promotion_popup_responses
  FOR INSERT TO hod_app WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.promotion_popup p
      WHERE p.id = promotion_popup_responses.promotion_id
        AND p.is_active = true
    )
  );
CREATE POLICY hod_app_f5_promotion_submission_insert ON public.promotion_popup_submissions
  FOR INSERT TO hod_app WITH CHECK (true);

COMMIT;
