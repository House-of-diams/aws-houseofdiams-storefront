-- PROPOSAL ONLY. Revert only the three new F5 policies; no data/grant changes.
BEGIN;
DO $f5_rollback_preflight$
BEGIN
  IF current_user <> 'hod_migration' THEN
    RAISE EXCEPTION 'Run as hod_migration';
  END IF;
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
    RAISE EXCEPTION 'F5 policies missing or changed; review before rollback';
  END IF;
END
$f5_rollback_preflight$;
DROP POLICY hod_app_f5_newsletter_insert ON public.newsletter_submissions;
DROP POLICY hod_app_f5_promotion_response_insert ON public.promotion_popup_responses;
DROP POLICY hod_app_f5_promotion_submission_insert ON public.promotion_popup_submissions;
COMMIT;
