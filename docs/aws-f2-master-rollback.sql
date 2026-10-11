-- PROPOSAL ONLY. NOT EXECUTED. Exact reverse of aws-f2-master-forward.sql.
-- Does NOT roll back the already verified F2-A taxonomy migration.
-- Stop/disable every F2 RDS activation flag before DevOps applies this.
-- No DML, function rewrite, auth-schema grant, BYPASSRLS, or RLS disable.

BEGIN;

DO $f2_master_rollback_preflight$
DECLARE
  expected record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='hod_app')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    RAISE EXCEPTION 'F2 rollback role state changed';
  END IF;
  FOR expected IN SELECT * FROM (VALUES
    ('about_founders','about founders admin write','{authenticated}'),
    ('about_hero','Public can read about hero','{anon,authenticated,hod_app}'),
    ('about_timeline','about timeline admin write','{authenticated}'),
    ('about_values','about values admin write','{authenticated}'),
    ('about_wide_banner','Public can read about wide banner','{anon,authenticated,hod_app}'),
    ('bespoke_form_carat_options','bespoke carat options admin write','{authenticated}'),
    ('bespoke_form_guarantees','bespoke guarantees admin write','{authenticated}'),
    ('bespoke_form_metal_options','bespoke metal options admin write','{authenticated}'),
    ('bespoke_form_piece_types','bespoke piece types admin write','{authenticated}'),
    ('bespoke_form_settings','bespoke form settings admin write','{authenticated}'),
    ('bespoke_form_stone_options','bespoke stone options admin write','{authenticated}'),
    ('bespoke_hero_content','bespoke hero admin write','{authenticated}'),
    ('bespoke_portfolio_categories','bespoke portfolio categories admin write','{authenticated}'),
    ('bespoke_process_cards','bespoke process cards admin write','{authenticated}'),
    ('bespoke_process_steps','bespoke process admin write','{authenticated}'),
    ('blog_page_hero','Public can read blog page hero','{anon,authenticated,hod_app}'),
    ('blog_post_tags','blog tags admin write','{authenticated}'),
    ('blog_posts','blog posts admin write','{authenticated}'),
    ('catalog_metals','catalog metals admin write','{authenticated}'),
    ('catalog_stone_shapes','catalog stone shapes admin write','{authenticated}'),
    ('catalog_styles','catalog styles admin write','{authenticated}'),
    ('certifications_items','certifications items admin write','{authenticated}'),
    ('certifications_section','certifications section admin write','{authenticated}'),
    ('cms_home_bestseller_products','cms home bestseller products admin write','{authenticated}'),
    ('cms_home_bestsellers','cms home bestsellers admin write','{authenticated}'),
    ('collection_items','collection admin write','{authenticated}'),
    ('contact_hero','contact hero admin write','{authenticated}'),
    ('contact_info','contact info admin write','{authenticated}'),
    ('couples_items','couples items admin write','{authenticated}'),
    ('couples_section','couples admin write','{authenticated}'),
    ('coupons','coupons admin write','{authenticated}'),
    ('docs_blocks','docs blocks admin write','{authenticated}'),
    ('docs_pages','docs pages admin write','{authenticated}'),
    ('education_page_hero','Public can read education hero','{anon,authenticated,hod_app}'),
    ('education_post_content_blocks','education_blocks_public_read','{anon,authenticated,hod_app}'),
    ('education_post_products','education_products_public_read','{anon,authenticated,hod_app}'),
    ('education_post_tags','education_tags_public_read','{anon,authenticated,hod_app}'),
    ('education_posts','education_posts_public_read','{anon,authenticated,hod_app}'),
    ('hiphop_showcase_section','hiphop showcase admin write','{authenticated}'),
    ('home_instagram_reels','instagram reels admin access','{authenticated}'),
    ('home_instagram_reels_section','instagram section admin access','{authenticated}'),
    ('homepage_hero_slider_items','hero slider admin write','{authenticated}'),
    ('homepage_shop_by_category','Public can read enabled shop by category section','{anon,authenticated,hod_app}'),
    ('homepage_shop_by_category_items','Public can read active shop by category items','{anon,authenticated,hod_app}'),
    ('material_strip_items','material strip admin write','{authenticated}'),
    ('navbar_featured_cards','navbar featured cards admin write','{authenticated}'),
    ('navbar_items','navbar items admin write','{authenticated}'),
    ('navbar_section_links','navbar section links admin write','{authenticated}'),
    ('navbar_section_source_items','navbar section source items admin write','{authenticated}'),
    ('navbar_sections','Admin can read navbar_sections','{authenticated}'),
    ('navbar_sections','navbar sections admin write','{authenticated}'),
    ('product_content_rules','product content rules admin write','{authenticated}'),
    ('product_metal_selections','product metal selections admin write','{authenticated}'),
    ('products','products admin write','{authenticated}'),
    ('promotion_popup','promotion popup admin write','{authenticated}'),
    ('promotion_popup_questions','Public can view active promotion questions','{anon,authenticated,hod_app}'),
    ('site_settings','site settings admin write','{authenticated}'),
    ('stats_strip_items','stats strip admin write','{authenticated}'),
    ('support_announcement_bar','support announcement bar admin write','{authenticated}'),
    ('support_announcement_bar_items','support announcement items admin write','{authenticated}'),
    ('support_faq_categories','faq categories admin write','{authenticated}'),
    ('support_faq_items','support faq items admin write','{authenticated}'),
    ('support_faq_section','support faq section admin write','{authenticated}'),
    ('testimonials_items','testimonials items admin write','{authenticated}'),
    ('testimonials_section','testimonials admin write','{authenticated}')
  ) AS v(table_name,policy_name,expected_roles) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
        AND p.tablename=expected.table_name AND p.policyname=expected.policy_name
        AND p.roles::text=expected.expected_roles
    ) THEN
      RAISE EXCEPTION 'F2 rollback policy state changed: %.%',
        expected.table_name,expected.policy_name;
    END IF;
  END LOOP;
  FOR expected IN SELECT * FROM (VALUES
    ('bespoke_hero_slider_items','hod_app_f2_read_bespoke_hero_slider_items'),
    ('blog_post_content_blocks','hod_app_f2_read_blog_post_content_blocks'),
    ('blog_post_products','hod_app_f2_read_blog_post_products'),
    ('catalog_certificates','hod_app_f2_read_catalog_certificates'),
    ('catalog_gst_slabs','hod_app_f2_read_catalog_gst_slabs'),
    ('catalog_material_values','hod_app_f2_read_catalog_material_values'),
    ('catalog_ring_categories','hod_app_f2_read_catalog_ring_categories'),
    ('catalog_ring_category_sizes','hod_app_f2_read_catalog_ring_category_sizes'),
    ('collection_page_config','hod_app_f2_read_collection_page_config'),
    ('discover_shapes_items','hod_app_f2_read_discover_shapes_items'),
    ('home_bespoke_showcase_section','hod_app_f2_read_home_bespoke_showcase_section'),
    ('metal_composition_parts','hod_app_f2_read_metal_composition_parts'),
    ('product_faq_items','hod_app_f2_read_product_faq_items'),
    ('product_material_value_selections','hod_app_f2_read_product_material_value_selections'),
    ('product_metal_media','hod_app_f2_read_product_metal_media'),
    ('product_metal_variants','hod_app_f2_read_product_metal_variants'),
    ('product_option_links','hod_app_f2_read_product_option_links'),
    ('product_purity_prices','hod_app_f2_read_product_purity_prices'),
    ('product_stone_shapes','hod_app_f2_read_product_stone_shapes'),
    ('product_subcategory_links','hod_app_f2_read_product_subcategory_links'),
    ('product_variant_media_items','hod_app_f2_read_product_variant_media_items'),
    ('service_banner_blocks','hod_app_f2_read_service_banner_blocks'),
    ('service_banner_section','hod_app_f2_read_service_banner_section'),
    ('navbar_items','hod_app_f2_hidden_bespoke_navbar')
  ) AS v(table_name,policy_name) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
        AND p.tablename=expected.table_name AND p.policyname=expected.policy_name
        AND p.roles::text='{hod_app}' AND p.cmd='SELECT'
    ) THEN
      RAISE EXCEPTION 'F2 rollback created policy missing/changed: %.%',
        expected.table_name,expected.policy_name;
    END IF;
  END LOOP;
END $f2_master_rollback_preflight$;

-- Drop only the policies created by the master forward migration.
DROP POLICY "hod_app_f2_hidden_bespoke_navbar" ON public.navbar_items;
DROP POLICY "hod_app_f2_read_service_banner_section" ON public.service_banner_section;
DROP POLICY "hod_app_f2_read_service_banner_blocks" ON public.service_banner_blocks;
DROP POLICY "hod_app_f2_read_product_variant_media_items" ON public.product_variant_media_items;
DROP POLICY "hod_app_f2_read_product_subcategory_links" ON public.product_subcategory_links;
DROP POLICY "hod_app_f2_read_product_stone_shapes" ON public.product_stone_shapes;
DROP POLICY "hod_app_f2_read_product_purity_prices" ON public.product_purity_prices;
DROP POLICY "hod_app_f2_read_product_option_links" ON public.product_option_links;
DROP POLICY "hod_app_f2_read_product_metal_variants" ON public.product_metal_variants;
DROP POLICY "hod_app_f2_read_product_metal_media" ON public.product_metal_media;
DROP POLICY "hod_app_f2_read_product_material_value_selections" ON public.product_material_value_selections;
DROP POLICY "hod_app_f2_read_product_faq_items" ON public.product_faq_items;
DROP POLICY "hod_app_f2_read_metal_composition_parts" ON public.metal_composition_parts;
DROP POLICY "hod_app_f2_read_home_bespoke_showcase_section" ON public.home_bespoke_showcase_section;
DROP POLICY "hod_app_f2_read_discover_shapes_items" ON public.discover_shapes_items;
DROP POLICY "hod_app_f2_read_collection_page_config" ON public.collection_page_config;
DROP POLICY "hod_app_f2_read_catalog_ring_category_sizes" ON public.catalog_ring_category_sizes;
DROP POLICY "hod_app_f2_read_catalog_ring_categories" ON public.catalog_ring_categories;
DROP POLICY "hod_app_f2_read_catalog_material_values" ON public.catalog_material_values;
DROP POLICY "hod_app_f2_read_catalog_gst_slabs" ON public.catalog_gst_slabs;
DROP POLICY "hod_app_f2_read_catalog_certificates" ON public.catalog_certificates;
DROP POLICY "hod_app_f2_read_blog_post_products" ON public.blog_post_products;
DROP POLICY "hod_app_f2_read_blog_post_content_blocks" ON public.blog_post_content_blocks;
DROP POLICY "hod_app_f2_read_bespoke_hero_slider_items" ON public.bespoke_hero_slider_items;

-- Restore every existing policy's original role target from the audited export.
ALTER POLICY "about founders admin write" ON public.about_founders TO PUBLIC;
ALTER POLICY "Public can read about hero" ON public.about_hero TO anon, authenticated;
ALTER POLICY "about timeline admin write" ON public.about_timeline TO PUBLIC;
ALTER POLICY "about values admin write" ON public.about_values TO PUBLIC;
ALTER POLICY "Public can read about wide banner" ON public.about_wide_banner TO anon, authenticated;
ALTER POLICY "bespoke carat options admin write" ON public.bespoke_form_carat_options TO PUBLIC;
ALTER POLICY "bespoke guarantees admin write" ON public.bespoke_form_guarantees TO PUBLIC;
ALTER POLICY "bespoke metal options admin write" ON public.bespoke_form_metal_options TO PUBLIC;
ALTER POLICY "bespoke piece types admin write" ON public.bespoke_form_piece_types TO PUBLIC;
ALTER POLICY "bespoke form settings admin write" ON public.bespoke_form_settings TO PUBLIC;
ALTER POLICY "bespoke stone options admin write" ON public.bespoke_form_stone_options TO PUBLIC;
ALTER POLICY "bespoke hero admin write" ON public.bespoke_hero_content TO PUBLIC;
ALTER POLICY "bespoke portfolio categories admin write" ON public.bespoke_portfolio_categories TO PUBLIC;
ALTER POLICY "bespoke process cards admin write" ON public.bespoke_process_cards TO PUBLIC;
ALTER POLICY "bespoke process admin write" ON public.bespoke_process_steps TO PUBLIC;
ALTER POLICY "Public can read blog page hero" ON public.blog_page_hero TO anon, authenticated;
ALTER POLICY "blog tags admin write" ON public.blog_post_tags TO PUBLIC;
ALTER POLICY "blog posts admin write" ON public.blog_posts TO PUBLIC;
ALTER POLICY "catalog metals admin write" ON public.catalog_metals TO PUBLIC;
ALTER POLICY "catalog stone shapes admin write" ON public.catalog_stone_shapes TO PUBLIC;
ALTER POLICY "catalog styles admin write" ON public.catalog_styles TO PUBLIC;
ALTER POLICY "certifications items admin write" ON public.certifications_items TO PUBLIC;
ALTER POLICY "certifications section admin write" ON public.certifications_section TO PUBLIC;
ALTER POLICY "cms home bestseller products admin write" ON public.cms_home_bestseller_products TO PUBLIC;
ALTER POLICY "cms home bestsellers admin write" ON public.cms_home_bestsellers TO PUBLIC;
ALTER POLICY "collection admin write" ON public.collection_items TO PUBLIC;
ALTER POLICY "contact hero admin write" ON public.contact_hero TO PUBLIC;
ALTER POLICY "contact info admin write" ON public.contact_info TO PUBLIC;
ALTER POLICY "couples items admin write" ON public.couples_items TO PUBLIC;
ALTER POLICY "couples admin write" ON public.couples_section TO PUBLIC;
ALTER POLICY "coupons admin write" ON public.coupons TO PUBLIC;
ALTER POLICY "docs blocks admin write" ON public.docs_blocks TO PUBLIC;
ALTER POLICY "docs pages admin write" ON public.docs_pages TO PUBLIC;
ALTER POLICY "Public can read education hero" ON public.education_page_hero TO anon, authenticated;
ALTER POLICY "education_blocks_public_read" ON public.education_post_content_blocks TO anon, authenticated;
ALTER POLICY "education_products_public_read" ON public.education_post_products TO anon, authenticated;
ALTER POLICY "education_tags_public_read" ON public.education_post_tags TO anon, authenticated;
ALTER POLICY "education_posts_public_read" ON public.education_posts TO anon, authenticated;
ALTER POLICY "hiphop showcase admin write" ON public.hiphop_showcase_section TO PUBLIC;
ALTER POLICY "instagram reels admin access" ON public.home_instagram_reels TO PUBLIC;
ALTER POLICY "instagram section admin access" ON public.home_instagram_reels_section TO PUBLIC;
ALTER POLICY "hero slider admin write" ON public.homepage_hero_slider_items TO PUBLIC;
ALTER POLICY "Public can read enabled shop by category section" ON public.homepage_shop_by_category TO anon, authenticated;
ALTER POLICY "Public can read active shop by category items" ON public.homepage_shop_by_category_items TO anon, authenticated;
ALTER POLICY "material strip admin write" ON public.material_strip_items TO PUBLIC;
ALTER POLICY "navbar featured cards admin write" ON public.navbar_featured_cards TO PUBLIC;
ALTER POLICY "navbar items admin write" ON public.navbar_items TO PUBLIC;
ALTER POLICY "navbar section links admin write" ON public.navbar_section_links TO PUBLIC;
ALTER POLICY "navbar section source items admin write" ON public.navbar_section_source_items TO PUBLIC;
ALTER POLICY "Admin can read navbar_sections" ON public.navbar_sections TO PUBLIC;
ALTER POLICY "navbar sections admin write" ON public.navbar_sections TO PUBLIC;
ALTER POLICY "product content rules admin write" ON public.product_content_rules TO PUBLIC;
ALTER POLICY "product metal selections admin write" ON public.product_metal_selections TO PUBLIC;
ALTER POLICY "products admin write" ON public.products TO PUBLIC;
ALTER POLICY "promotion popup admin write" ON public.promotion_popup TO PUBLIC;
ALTER POLICY "Public can view active promotion questions" ON public.promotion_popup_questions TO anon, authenticated;
ALTER POLICY "site settings admin write" ON public.site_settings TO PUBLIC;
ALTER POLICY "stats strip admin write" ON public.stats_strip_items TO PUBLIC;
ALTER POLICY "support announcement bar admin write" ON public.support_announcement_bar TO PUBLIC;
ALTER POLICY "support announcement items admin write" ON public.support_announcement_bar_items TO PUBLIC;
ALTER POLICY "faq categories admin write" ON public.support_faq_categories TO PUBLIC;
ALTER POLICY "support faq items admin write" ON public.support_faq_items TO PUBLIC;
ALTER POLICY "support faq section admin write" ON public.support_faq_section TO PUBLIC;
ALTER POLICY "testimonials items admin write" ON public.testimonials_items TO PUBLIC;
ALTER POLICY "testimonials admin write" ON public.testimonials_section TO PUBLIC;

COMMIT;
