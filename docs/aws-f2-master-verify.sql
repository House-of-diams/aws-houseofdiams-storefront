-- READ-ONLY F2 MASTER VERIFICATION. Run only AFTER DevOps-approved forward migration.
-- Never paste DB passwords here. Connect directly as hod_app for the data probes.
-- Do not run these probes as a superuser or a BYPASSRLS role: that would not test RLS.
-- A zero visible count can be legitimate; compare current storefront output/data.

BEGIN READ ONLY;

-- Connection identity and F2-A taxonomy snapshot. Expect current_user=hod_app,
-- category/subcategory/option counts 6/10/35 at the user-reported snapshot.
SELECT current_user, current_database(),
       (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS ssl_in_use;
SELECT 'catalog_categories' AS table_name, count(*) AS visible_rows FROM public.catalog_categories
UNION ALL SELECT 'catalog_subcategories', count(*) FROM public.catalog_subcategories
UNION ALL SELECT 'catalog_options', count(*) FROM public.catalog_options;

-- Every remaining read relation must be queryable without auth.uid()/schema-auth errors.
-- This intentionally evaluates RLS on all rows; execute in staging at low load.
-- Navbar
SELECT table_name, visible_rows FROM (
  SELECT 'navbar_featured_cards'::text AS table_name, count(*)::bigint AS visible_rows FROM public.navbar_featured_cards
  UNION ALL SELECT 'navbar_items'::text AS table_name, count(*)::bigint AS visible_rows FROM public.navbar_items
  UNION ALL SELECT 'navbar_section_links'::text AS table_name, count(*)::bigint AS visible_rows FROM public.navbar_section_links
  UNION ALL SELECT 'navbar_section_source_items'::text AS table_name, count(*)::bigint AS visible_rows FROM public.navbar_section_source_items
  UNION ALL SELECT 'navbar_sections'::text AS table_name, count(*)::bigint AS visible_rows FROM public.navbar_sections
) AS section_counts ORDER BY table_name;

-- Products/catalog
SELECT table_name, visible_rows FROM (
  SELECT 'catalog_certificates'::text AS table_name, count(*)::bigint AS visible_rows FROM public.catalog_certificates
  UNION ALL SELECT 'catalog_gst_slabs'::text AS table_name, count(*)::bigint AS visible_rows FROM public.catalog_gst_slabs
  UNION ALL SELECT 'catalog_material_values'::text AS table_name, count(*)::bigint AS visible_rows FROM public.catalog_material_values
  UNION ALL SELECT 'catalog_metals'::text AS table_name, count(*)::bigint AS visible_rows FROM public.catalog_metals
  UNION ALL SELECT 'catalog_ring_categories'::text AS table_name, count(*)::bigint AS visible_rows FROM public.catalog_ring_categories
  UNION ALL SELECT 'catalog_ring_category_sizes'::text AS table_name, count(*)::bigint AS visible_rows FROM public.catalog_ring_category_sizes
  UNION ALL SELECT 'catalog_stone_shapes'::text AS table_name, count(*)::bigint AS visible_rows FROM public.catalog_stone_shapes
  UNION ALL SELECT 'catalog_styles'::text AS table_name, count(*)::bigint AS visible_rows FROM public.catalog_styles
  UNION ALL SELECT 'metal_composition_parts'::text AS table_name, count(*)::bigint AS visible_rows FROM public.metal_composition_parts
  UNION ALL SELECT 'product_content_rules'::text AS table_name, count(*)::bigint AS visible_rows FROM public.product_content_rules
  UNION ALL SELECT 'product_custom_dropdown_options'::text AS table_name, count(*)::bigint AS visible_rows FROM public.product_custom_dropdown_options
  UNION ALL SELECT 'product_custom_dropdowns'::text AS table_name, count(*)::bigint AS visible_rows FROM public.product_custom_dropdowns
  UNION ALL SELECT 'product_faq_items'::text AS table_name, count(*)::bigint AS visible_rows FROM public.product_faq_items
  UNION ALL SELECT 'product_material_value_selections'::text AS table_name, count(*)::bigint AS visible_rows FROM public.product_material_value_selections
  UNION ALL SELECT 'product_metal_media'::text AS table_name, count(*)::bigint AS visible_rows FROM public.product_metal_media
  UNION ALL SELECT 'product_metal_selections'::text AS table_name, count(*)::bigint AS visible_rows FROM public.product_metal_selections
  UNION ALL SELECT 'product_metal_variants'::text AS table_name, count(*)::bigint AS visible_rows FROM public.product_metal_variants
  UNION ALL SELECT 'product_option_links'::text AS table_name, count(*)::bigint AS visible_rows FROM public.product_option_links
  UNION ALL SELECT 'product_purity_prices'::text AS table_name, count(*)::bigint AS visible_rows FROM public.product_purity_prices
  UNION ALL SELECT 'product_stone_shapes'::text AS table_name, count(*)::bigint AS visible_rows FROM public.product_stone_shapes
  UNION ALL SELECT 'product_subcategory_links'::text AS table_name, count(*)::bigint AS visible_rows FROM public.product_subcategory_links
  UNION ALL SELECT 'product_variant_media_items'::text AS table_name, count(*)::bigint AS visible_rows FROM public.product_variant_media_items
  UNION ALL SELECT 'products'::text AS table_name, count(*)::bigint AS visible_rows FROM public.products
) AS section_counts ORDER BY table_name;

-- Homepage/CMS
SELECT table_name, visible_rows FROM (
  SELECT 'certifications_items'::text AS table_name, count(*)::bigint AS visible_rows FROM public.certifications_items
  UNION ALL SELECT 'certifications_section'::text AS table_name, count(*)::bigint AS visible_rows FROM public.certifications_section
  UNION ALL SELECT 'cms_home_bestseller_products'::text AS table_name, count(*)::bigint AS visible_rows FROM public.cms_home_bestseller_products
  UNION ALL SELECT 'cms_home_bestsellers'::text AS table_name, count(*)::bigint AS visible_rows FROM public.cms_home_bestsellers
  UNION ALL SELECT 'collection_items'::text AS table_name, count(*)::bigint AS visible_rows FROM public.collection_items
  UNION ALL SELECT 'collection_page_config'::text AS table_name, count(*)::bigint AS visible_rows FROM public.collection_page_config
  UNION ALL SELECT 'couples_items'::text AS table_name, count(*)::bigint AS visible_rows FROM public.couples_items
  UNION ALL SELECT 'couples_section'::text AS table_name, count(*)::bigint AS visible_rows FROM public.couples_section
  UNION ALL SELECT 'discover_shapes_items'::text AS table_name, count(*)::bigint AS visible_rows FROM public.discover_shapes_items
  UNION ALL SELECT 'hiphop_showcase_section'::text AS table_name, count(*)::bigint AS visible_rows FROM public.hiphop_showcase_section
  UNION ALL SELECT 'home_bespoke_showcase_section'::text AS table_name, count(*)::bigint AS visible_rows FROM public.home_bespoke_showcase_section
  UNION ALL SELECT 'home_instagram_reels'::text AS table_name, count(*)::bigint AS visible_rows FROM public.home_instagram_reels
  UNION ALL SELECT 'home_instagram_reels_section'::text AS table_name, count(*)::bigint AS visible_rows FROM public.home_instagram_reels_section
  UNION ALL SELECT 'homepage_hero'::text AS table_name, count(*)::bigint AS visible_rows FROM public.homepage_hero
  UNION ALL SELECT 'homepage_hero_slider_items'::text AS table_name, count(*)::bigint AS visible_rows FROM public.homepage_hero_slider_items
  UNION ALL SELECT 'homepage_shop_by_category'::text AS table_name, count(*)::bigint AS visible_rows FROM public.homepage_shop_by_category
  UNION ALL SELECT 'homepage_shop_by_category_items'::text AS table_name, count(*)::bigint AS visible_rows FROM public.homepage_shop_by_category_items
  UNION ALL SELECT 'material_strip_items'::text AS table_name, count(*)::bigint AS visible_rows FROM public.material_strip_items
  UNION ALL SELECT 'service_banner_blocks'::text AS table_name, count(*)::bigint AS visible_rows FROM public.service_banner_blocks
  UNION ALL SELECT 'service_banner_section'::text AS table_name, count(*)::bigint AS visible_rows FROM public.service_banner_section
  UNION ALL SELECT 'stats_strip_items'::text AS table_name, count(*)::bigint AS visible_rows FROM public.stats_strip_items
) AS section_counts ORDER BY table_name;

-- Blog/education
SELECT table_name, visible_rows FROM (
  SELECT 'blog_page_hero'::text AS table_name, count(*)::bigint AS visible_rows FROM public.blog_page_hero
  UNION ALL SELECT 'blog_post_content_blocks'::text AS table_name, count(*)::bigint AS visible_rows FROM public.blog_post_content_blocks
  UNION ALL SELECT 'blog_post_products'::text AS table_name, count(*)::bigint AS visible_rows FROM public.blog_post_products
  UNION ALL SELECT 'blog_post_tags'::text AS table_name, count(*)::bigint AS visible_rows FROM public.blog_post_tags
  UNION ALL SELECT 'blog_posts'::text AS table_name, count(*)::bigint AS visible_rows FROM public.blog_posts
  UNION ALL SELECT 'education_page_hero'::text AS table_name, count(*)::bigint AS visible_rows FROM public.education_page_hero
  UNION ALL SELECT 'education_post_content_blocks'::text AS table_name, count(*)::bigint AS visible_rows FROM public.education_post_content_blocks
  UNION ALL SELECT 'education_post_products'::text AS table_name, count(*)::bigint AS visible_rows FROM public.education_post_products
  UNION ALL SELECT 'education_post_tags'::text AS table_name, count(*)::bigint AS visible_rows FROM public.education_post_tags
  UNION ALL SELECT 'education_posts'::text AS table_name, count(*)::bigint AS visible_rows FROM public.education_posts
) AS section_counts ORDER BY table_name;

-- Bespoke
SELECT table_name, visible_rows FROM (
  SELECT 'bespoke_form_carat_options'::text AS table_name, count(*)::bigint AS visible_rows FROM public.bespoke_form_carat_options
  UNION ALL SELECT 'bespoke_form_guarantees'::text AS table_name, count(*)::bigint AS visible_rows FROM public.bespoke_form_guarantees
  UNION ALL SELECT 'bespoke_form_metal_options'::text AS table_name, count(*)::bigint AS visible_rows FROM public.bespoke_form_metal_options
  UNION ALL SELECT 'bespoke_form_piece_types'::text AS table_name, count(*)::bigint AS visible_rows FROM public.bespoke_form_piece_types
  UNION ALL SELECT 'bespoke_form_settings'::text AS table_name, count(*)::bigint AS visible_rows FROM public.bespoke_form_settings
  UNION ALL SELECT 'bespoke_form_stone_options'::text AS table_name, count(*)::bigint AS visible_rows FROM public.bespoke_form_stone_options
  UNION ALL SELECT 'bespoke_hero_content'::text AS table_name, count(*)::bigint AS visible_rows FROM public.bespoke_hero_content
  UNION ALL SELECT 'bespoke_hero_slider_items'::text AS table_name, count(*)::bigint AS visible_rows FROM public.bespoke_hero_slider_items
  UNION ALL SELECT 'bespoke_portfolio_categories'::text AS table_name, count(*)::bigint AS visible_rows FROM public.bespoke_portfolio_categories
  UNION ALL SELECT 'bespoke_portfolio_items'::text AS table_name, count(*)::bigint AS visible_rows FROM public.bespoke_portfolio_items
  UNION ALL SELECT 'bespoke_process_cards'::text AS table_name, count(*)::bigint AS visible_rows FROM public.bespoke_process_cards
  UNION ALL SELECT 'bespoke_process_steps'::text AS table_name, count(*)::bigint AS visible_rows FROM public.bespoke_process_steps
) AS section_counts ORDER BY table_name;

-- Settings/support/about
SELECT table_name, visible_rows FROM (
  SELECT 'about_founders'::text AS table_name, count(*)::bigint AS visible_rows FROM public.about_founders
  UNION ALL SELECT 'about_hero'::text AS table_name, count(*)::bigint AS visible_rows FROM public.about_hero
  UNION ALL SELECT 'about_timeline'::text AS table_name, count(*)::bigint AS visible_rows FROM public.about_timeline
  UNION ALL SELECT 'about_values'::text AS table_name, count(*)::bigint AS visible_rows FROM public.about_values
  UNION ALL SELECT 'about_wide_banner'::text AS table_name, count(*)::bigint AS visible_rows FROM public.about_wide_banner
  UNION ALL SELECT 'contact_hero'::text AS table_name, count(*)::bigint AS visible_rows FROM public.contact_hero
  UNION ALL SELECT 'contact_info'::text AS table_name, count(*)::bigint AS visible_rows FROM public.contact_info
  UNION ALL SELECT 'docs_blocks'::text AS table_name, count(*)::bigint AS visible_rows FROM public.docs_blocks
  UNION ALL SELECT 'docs_pages'::text AS table_name, count(*)::bigint AS visible_rows FROM public.docs_pages
  UNION ALL SELECT 'site_settings'::text AS table_name, count(*)::bigint AS visible_rows FROM public.site_settings
  UNION ALL SELECT 'support_announcement_bar'::text AS table_name, count(*)::bigint AS visible_rows FROM public.support_announcement_bar
  UNION ALL SELECT 'support_announcement_bar_items'::text AS table_name, count(*)::bigint AS visible_rows FROM public.support_announcement_bar_items
  UNION ALL SELECT 'support_faq_categories'::text AS table_name, count(*)::bigint AS visible_rows FROM public.support_faq_categories
  UNION ALL SELECT 'support_faq_items'::text AS table_name, count(*)::bigint AS visible_rows FROM public.support_faq_items
  UNION ALL SELECT 'support_faq_section'::text AS table_name, count(*)::bigint AS visible_rows FROM public.support_faq_section
) AS section_counts ORDER BY table_name;

-- Testimonials
SELECT table_name, visible_rows FROM (
  SELECT 'testimonials_items'::text AS table_name, count(*)::bigint AS visible_rows FROM public.testimonials_items
  UNION ALL SELECT 'testimonials_section'::text AS table_name, count(*)::bigint AS visible_rows FROM public.testimonials_section
) AS section_counts ORDER BY table_name;

-- Promotions
SELECT table_name, visible_rows FROM (
  SELECT 'coupons'::text AS table_name, count(*)::bigint AS visible_rows FROM public.coupons
  UNION ALL SELECT 'promotion_popup'::text AS table_name, count(*)::bigint AS visible_rows FROM public.promotion_popup
  UNION ALL SELECT 'promotion_popup_questions'::text AS table_name, count(*)::bigint AS visible_rows FROM public.promotion_popup_questions
) AS section_counts ORDER BY table_name;

-- Negative visibility checks under hod_app: expect zero unless a policy review
-- explicitly documents a different public rule. Current SELECT policies remain.
SELECT 'hidden_products' AS check_name, count(*) AS visible_rows
  FROM public.products WHERE status IS DISTINCT FROM 'active'::product_status
UNION ALL SELECT 'unpublished_blog_posts', count(*) FROM public.blog_posts WHERE is_published IS DISTINCT FROM true
UNION ALL SELECT 'unpublished_education_posts', count(*) FROM public.education_posts WHERE is_published IS DISTINCT FROM true
UNION ALL SELECT 'other_hidden_navbar_items', count(*) FROM public.navbar_items
  WHERE status = 'hidden'::navbar_status AND slug IS DISTINCT FROM 'bespoke'
UNION ALL SELECT 'hidden_gst_slabs', count(*) FROM public.catalog_gst_slabs WHERE status = 'hidden';

ROLLBACK;

-- Optional DevOps policy audit in a separate READ ONLY privileged session.
-- BEFORE approval, export the grant vector that was not present in the
-- supplied policy CSV. Review any unexpected write privileges; the migration
-- neither grants nor revokes them. Use the 94-table scope in the forward
-- preflight to scope this query rather than broadening to unrelated tables.
-- SELECT c.relname AS table_name,
--   has_table_privilege('hod_app', c.oid, 'SELECT') AS can_select,
--   has_table_privilege('hod_app', c.oid, 'INSERT') AS can_insert,
--   has_table_privilege('hod_app', c.oid, 'UPDATE') AS can_update,
--   has_table_privilege('hod_app', c.oid, 'DELETE') AS can_delete
-- FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
-- WHERE n.nspname='public' AND c.relkind IN ('r','p')
-- ORDER BY c.relname;
--
-- Expect: 54 legacy admin policy roles now authenticated; 11 previously
-- anon/authenticated SELECT policies additionally include hod_app; 29 new
-- hod_app-only SELECT policies plus one hidden-bespoke navbar policy; F2-A
-- taxonomy admin policies remain authenticated. Public SELECT predicates are
-- unchanged. No RLS disable, auth grant, BYPASSRLS, or data writes.
-- BEGIN READ ONLY;
-- SELECT tablename, policyname, roles, cmd, qual, with_check FROM pg_policies
-- WHERE schemaname='public' ORDER BY tablename, policyname;
-- SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname='hod_app';
-- ROLLBACK;
