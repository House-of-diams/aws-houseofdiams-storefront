-- PROPOSAL ONLY. DO NOT EXECUTE UNTIL REVIEWED WITH DEVOPS.
-- SUPERSEDED by aws-f2-master-forward.sql for the complete remaining F2 review.
-- Do not run both this standalone proposal and the master migration.
-- F2-C: one public read-only CMS endpoint, testimonial marquee.
-- Verified read-only against staging RDS: both tables exist, RLS is enabled,
-- neither has a policy, hod_app has SELECT, id/marquee_id are bigint, and
-- testimonial_marquee_items.marquee_id references testimonial_marquee(id).
-- Current application reads only section_key='home_testimonial_marquee' and
-- its items by marquee_id. No data, admin policy, or write function is changed.

BEGIN;

DO $f2_testimonial_preflight$
DECLARE
  table_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hod_app') THEN
    RAISE EXCEPTION 'hod_app role missing';
  END IF;
  FOREACH table_name IN ARRAY ARRAY['testimonial_marquee', 'testimonial_marquee_items'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = table_name
        AND c.relkind IN ('r', 'p') AND c.relrowsecurity AND NOT c.relforcerowsecurity
    ) OR NOT has_table_privilege('hod_app', format('public.%I', table_name), 'SELECT')
       OR EXISTS (
         SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public'
           AND p.tablename = table_name
       ) THEN
      RAISE EXCEPTION 'F2 testimonial table/RLS/grant/policy state changed: %', table_name;
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint p JOIN pg_class c ON c.oid = p.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'testimonial_marquee_items'
      AND p.conname = 'testimonial_marquee_items_marquee_id_fkey'
      AND p.contype = 'f'
      AND pg_get_constraintdef(p.oid) =
        'FOREIGN KEY (marquee_id) REFERENCES testimonial_marquee(id) ON DELETE CASCADE'
  ) THEN
    RAISE EXCEPTION 'F2 testimonial parent FK changed';
  END IF;
END $f2_testimonial_preflight$;

CREATE POLICY hod_app_home_testimonial_marquee_read ON public.testimonial_marquee
  FOR SELECT TO hod_app USING (section_key = 'home_testimonial_marquee');
CREATE POLICY hod_app_home_testimonial_marquee_items_read ON public.testimonial_marquee_items
  FOR SELECT TO hod_app USING (
    EXISTS (
      SELECT 1 FROM public.testimonial_marquee m
      WHERE m.id = marquee_id AND m.section_key = 'home_testimonial_marquee'
    )
  );

COMMIT;

-- READ-ONLY VERIFICATION AFTER REVIEW/APPLICATION:
-- SELECT tablename, policyname, roles, cmd, qual FROM pg_policies
-- WHERE schemaname = 'public' AND tablename IN
-- ('testimonial_marquee', 'testimonial_marquee_items') ORDER BY tablename;
-- Under hod_app in a separate READ ONLY transaction:
-- SELECT id, title FROM public.testimonial_marquee
-- WHERE section_key = 'home_testimonial_marquee' LIMIT 1;
-- SELECT id, sort_order, quote, author FROM public.testimonial_marquee_items
-- WHERE marquee_id = <returned id> ORDER BY sort_order ASC;
-- Compare /api/public/testimonial-marquee response shape and output to current
-- Supabase behavior, including no-row default and revalidation after 300 s.

/* EXACT ROLLBACK (review and run separately)
BEGIN;
DROP POLICY hod_app_home_testimonial_marquee_items_read ON public.testimonial_marquee_items;
DROP POLICY hod_app_home_testimonial_marquee_read ON public.testimonial_marquee;
COMMIT;
*/
