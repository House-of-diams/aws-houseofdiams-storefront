-- Run as hod_app, not as the table owner. This transaction makes no changes.
BEGIN READ ONLY;
SELECT current_user, (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS ssl_in_use;
SELECT 'cms_summary_sections' AS table_name, count(*) AS visible_rows FROM public.cms_summary_sections
UNION ALL SELECT 'cms_summary_pointers', count(*) FROM public.cms_summary_pointers;
SELECT id, section_key, is_enabled FROM public.cms_summary_sections
 WHERE section_key = 'additional_summary_details' LIMIT 2;
ROLLBACK;
