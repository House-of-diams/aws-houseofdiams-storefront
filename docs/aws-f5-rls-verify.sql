-- Read-only metadata verification. No form INSERTs or sequence increments.
BEGIN READ ONLY;
SELECT current_user;
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'hod_app';
SELECT c.relname, pg_get_userbyid(c.relowner) AS owner,
  c.relrowsecurity, c.relforcerowsecurity,
  has_table_privilege('hod_app', c.oid, 'INSERT') AS insert_granted
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN (
  'contact_submissions', 'bespoke_submissions', 'newsletter_submissions',
  'promotion_popup_responses', 'promotion_popup_submissions') ORDER BY c.relname;
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename IN (
  'contact_submissions', 'bespoke_submissions', 'newsletter_submissions',
  'promotion_popup_responses', 'promotion_popup_submissions') ORDER BY tablename, policyname;
DO $f5_verify$
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
    AND (tablename, policyname) IN (
      ('newsletter_submissions', 'hod_app_f5_newsletter_insert'),
      ('promotion_popup_submissions', 'hod_app_f5_promotion_submission_insert'))
    AND permissive = 'PERMISSIVE' AND roles = ARRAY['hod_app']::name[]
    AND cmd = 'INSERT' AND qual IS NULL AND with_check = 'true') <> 2 OR NOT EXISTS (
    SELECT 1 FROM pg_policies p
    JOIN pg_policies existing ON existing.schemaname = p.schemaname
      AND existing.tablename = p.tablename
      AND existing.policyname = 'Public can submit promotion responses'
    WHERE p.schemaname = 'public' AND p.tablename = 'promotion_popup_responses'
      AND p.policyname = 'hod_app_f5_promotion_response_insert'
      AND p.permissive = 'PERMISSIVE' AND p.roles = ARRAY['hod_app']::name[]
      AND p.cmd = 'INSERT' AND p.qual IS NULL
      AND p.with_check = existing.with_check
  ) THEN
    RAISE EXCEPTION 'F5 INSERT policy verification failed';
  END IF;
END
$f5_verify$;
ROLLBACK;
