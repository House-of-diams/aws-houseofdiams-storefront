-- Use only if the separately reviewed F2 summary migration must be reversed.
BEGIN;
ALTER POLICY "Summary pointers admin write" ON public.cms_summary_pointers TO PUBLIC;
ALTER POLICY "Summary admin write" ON public.cms_summary_sections TO PUBLIC;
COMMIT;
