-- PROPOSAL ONLY. NOT EXECUTED. DevOps review required before staging use.
-- F2 MASTER FORWARD: all remaining storefront read-side RLS changes after verified F2-A.
-- Supersedes the separate navbar and testimonial proposals. Do NOT apply those
-- separately if this master migration is used. No F7 checkout/write tables.
-- No DML, function rewrite, auth-schema grant, BYPASSRLS, or RLS disable.
-- Legacy is_admin()/auth.uid() admin policies narrowed TO authenticated below
-- are a TEMPORARY STAGING BRIDGE, not final Keycloak admin architecture.
-- Confirm current admin sessions use authenticated or an independently
-- authorized bypassing role before approval; replace bridge at admin cutover.
-- Source: supplied 2026-10-07 pg_policies export + current branch read audit.
-- Strict preflight checks exact old policies for all 94 in-scope F2 tables, including
-- the three F2-A taxonomy policies now expected TO authenticated.

BEGIN;

DO $f2_master_preflight$
DECLARE
  expected_policies jsonb := $f2_expected$[["about_founders","about founders admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["about_founders","about founders public read","PERMISSIVE","{public}","SELECT","true",null],["about_hero","Public can read about hero","PERMISSIVE","{anon,authenticated}","SELECT","true",null],["about_timeline","about timeline admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["about_timeline","about timeline public read","PERMISSIVE","{public}","SELECT","true",null],["about_values","about values admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["about_values","about values public read","PERMISSIVE","{public}","SELECT","true",null],["about_wide_banner","Public can read about wide banner","PERMISSIVE","{anon,authenticated}","SELECT","true",null],["bespoke_form_carat_options","bespoke carat options admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["bespoke_form_carat_options","bespoke carat options public read","PERMISSIVE","{public}","SELECT","(status = 'active'::bespoke_status)",null],["bespoke_form_guarantees","bespoke guarantees admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["bespoke_form_guarantees","bespoke guarantees public read","PERMISSIVE","{public}","SELECT","(status = 'active'::bespoke_status)",null],["bespoke_form_metal_options","bespoke metal options admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["bespoke_form_metal_options","bespoke metal options public read","PERMISSIVE","{public}","SELECT","(status = 'active'::bespoke_status)",null],["bespoke_form_piece_types","bespoke piece types admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["bespoke_form_piece_types","bespoke piece types public read","PERMISSIVE","{public}","SELECT","(status = 'active'::bespoke_status)",null],["bespoke_form_settings","bespoke form settings admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["bespoke_form_settings","bespoke form settings public read","PERMISSIVE","{public}","SELECT","(status = 'active'::bespoke_status)",null],["bespoke_form_stone_options","bespoke stone options admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["bespoke_form_stone_options","bespoke stone options public read","PERMISSIVE","{public}","SELECT","(status = 'active'::bespoke_status)",null],["bespoke_hero_content","bespoke hero admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["bespoke_hero_content","bespoke hero public read","PERMISSIVE","{public}","SELECT","(status = 'active'::bespoke_status)",null],["bespoke_portfolio_categories","bespoke portfolio categories admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["bespoke_portfolio_categories","bespoke portfolio categories public read","PERMISSIVE","{public}","SELECT","(status = 'active'::bespoke_status)",null],["bespoke_portfolio_items","bespoke portfolio items admin write","PERMISSIVE","{authenticated}","ALL","is_admin()","is_admin()"],["bespoke_portfolio_items","bespoke portfolio items public read","PERMISSIVE","{public}","SELECT","(status = 'active'::bespoke_status)",null],["bespoke_process_cards","bespoke process cards admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["bespoke_process_cards","bespoke process cards public read","PERMISSIVE","{public}","SELECT","true",null],["bespoke_process_steps","bespoke process admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["bespoke_process_steps","bespoke process public read","PERMISSIVE","{public}","SELECT","true",null],["blog_page_hero","Public can read blog page hero","PERMISSIVE","{anon,authenticated}","SELECT","true",null],["blog_post_tags","blog tags admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["blog_post_tags","blog tags public read","PERMISSIVE","{public}","SELECT","(EXISTS ( SELECT 1\n   FROM blog_posts p\n  WHERE ((p.id = blog_post_tags.post_id) AND (p.is_published = true))))",null],["blog_posts","blog posts admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["blog_posts","blog posts public read","PERMISSIVE","{public}","SELECT","(is_published = true)",null],["catalog_categories","catalog categories admin write","PERMISSIVE","{authenticated}","ALL","is_admin()","is_admin()"],["catalog_categories","catalog categories public read","PERMISSIVE","{public}","SELECT","(status = 'active'::catalog_status)",null],["catalog_metals","catalog metals admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["catalog_metals","catalog metals public read","PERMISSIVE","{public}","SELECT","(status = 'active'::catalog_status)",null],["catalog_options","catalog options admin write","PERMISSIVE","{authenticated}","ALL","is_admin()","is_admin()"],["catalog_options","catalog options public read","PERMISSIVE","{public}","SELECT","(status = 'active'::catalog_status)",null],["catalog_stone_shapes","catalog stone shapes admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["catalog_stone_shapes","catalog stone shapes public read","PERMISSIVE","{public}","SELECT","(status = 'active'::catalog_status)",null],["catalog_styles","catalog styles admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["catalog_styles","catalog styles public read","PERMISSIVE","{public}","SELECT","true",null],["catalog_subcategories","catalog subcategories admin write","PERMISSIVE","{authenticated}","ALL","is_admin()","is_admin()"],["catalog_subcategories","catalog subcategories public read","PERMISSIVE","{public}","SELECT","(status = 'active'::catalog_status)",null],["certifications_items","certifications items admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["certifications_items","certifications items public read","PERMISSIVE","{public}","SELECT","true",null],["certifications_section","certifications section admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["certifications_section","certifications section public read","PERMISSIVE","{public}","SELECT","true",null],["cms_home_bestseller_products","cms home bestseller products admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["cms_home_bestseller_products","cms home bestseller products public read","PERMISSIVE","{public}","SELECT","(EXISTS ( SELECT 1\n   FROM cms_home_bestsellers s\n  WHERE ((s.id = cms_home_bestseller_products.section_id) AND (s.status = 'active'::cms_status))))",null],["cms_home_bestsellers","cms home bestsellers admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["cms_home_bestsellers","cms home bestsellers public read","PERMISSIVE","{public}","SELECT","(status = 'active'::cms_status)",null],["collection_items","collection admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["collection_items","collection public read","PERMISSIVE","{public}","SELECT","true",null],["contact_hero","contact hero admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["contact_hero","contact hero public read","PERMISSIVE","{public}","SELECT","true",null],["contact_info","contact info admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["contact_info","contact info public read","PERMISSIVE","{public}","SELECT","true",null],["couples_items","couples items admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["couples_items","couples items public read","PERMISSIVE","{public}","SELECT","true",null],["couples_section","couples admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["couples_section","couples public read","PERMISSIVE","{public}","SELECT","true",null],["coupons","coupons admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["coupons","coupons public read","PERMISSIVE","{public}","SELECT","true",null],["docs_blocks","docs blocks admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["docs_blocks","docs blocks public read","PERMISSIVE","{public}","SELECT","true",null],["docs_pages","docs pages admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["docs_pages","docs pages public read","PERMISSIVE","{public}","SELECT","true",null],["education_page_hero","Public can read education hero","PERMISSIVE","{anon,authenticated}","SELECT","true",null],["education_post_content_blocks","education_blocks_public_read","PERMISSIVE","{anon,authenticated}","SELECT","((is_enabled = true) AND (EXISTS ( SELECT 1\n   FROM education_posts\n  WHERE ((education_posts.id = education_post_content_blocks.post_id) AND (education_posts.is_published = true)))))",null],["education_post_products","education_products_public_read","PERMISSIVE","{anon,authenticated}","SELECT","(EXISTS ( SELECT 1\n   FROM education_posts\n  WHERE ((education_posts.id = education_post_products.post_id) AND (education_posts.is_published = true))))",null],["education_post_tags","education_tags_public_read","PERMISSIVE","{anon,authenticated}","SELECT","(EXISTS ( SELECT 1\n   FROM education_posts\n  WHERE ((education_posts.id = education_post_tags.post_id) AND (education_posts.is_published = true))))",null],["education_posts","education_posts_public_read","PERMISSIVE","{anon,authenticated}","SELECT","(is_published = true)",null],["hiphop_showcase_section","hiphop showcase admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["hiphop_showcase_section","hiphop showcase public read","PERMISSIVE","{public}","SELECT","true",null],["home_instagram_reels","instagram reels admin access","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["home_instagram_reels","instagram reels public read","PERMISSIVE","{public}","SELECT","(is_enabled = true)",null],["home_instagram_reels_section","instagram section admin access","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["home_instagram_reels_section","instagram section public read","PERMISSIVE","{public}","SELECT","(is_enabled = true)",null],["homepage_hero","hero admin delete","PERMISSIVE","{public}","DELETE","is_admin()",null],["homepage_hero","hero admin insert","PERMISSIVE","{public}","INSERT",null,"is_admin()"],["homepage_hero","hero admin update","PERMISSIVE","{public}","UPDATE","is_admin()","is_admin()"],["homepage_hero","hero public read","PERMISSIVE","{public}","SELECT","(is_active = true)",null],["homepage_hero_slider_items","hero slider admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["homepage_hero_slider_items","hero slider public read","PERMISSIVE","{public}","SELECT","(EXISTS ( SELECT 1\n   FROM homepage_hero h\n  WHERE ((h.id = homepage_hero_slider_items.hero_id) AND (h.is_active = true))))",null],["homepage_shop_by_category","Public can read enabled shop by category section","PERMISSIVE","{anon,authenticated}","SELECT","(is_enabled = true)",null],["homepage_shop_by_category_items","Public can read active shop by category items","PERMISSIVE","{anon,authenticated}","SELECT","((is_active = true) AND (EXISTS ( SELECT 1\n   FROM homepage_shop_by_category section\n  WHERE ((section.id = homepage_shop_by_category_items.section_id) AND (section.is_enabled = true)))))",null],["material_strip_items","material strip admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["material_strip_items","material strip public read","PERMISSIVE","{public}","SELECT","true",null],["navbar_featured_cards","navbar featured cards admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["navbar_featured_cards","navbar featured cards public read","PERMISSIVE","{public}","SELECT","true",null],["navbar_items","navbar items admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["navbar_items","navbar items public read","PERMISSIVE","{public}","SELECT","(status = 'active'::navbar_status)",null],["navbar_section_links","navbar section links admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["navbar_section_links","navbar section links public read","PERMISSIVE","{public}","SELECT","(status = 'active'::navbar_status)",null],["navbar_section_source_items","navbar section source items admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["navbar_section_source_items","navbar section source items public read","PERMISSIVE","{public}","SELECT","true",null],["navbar_sections","Admin can read navbar_sections","PERMISSIVE","{public}","SELECT","is_admin()",null],["navbar_sections","navbar sections admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["navbar_sections","navbar sections public read","PERMISSIVE","{public}","SELECT","(status = 'active'::navbar_status)",null],["product_content_rules","product content rules admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["product_content_rules","product content rules public read","PERMISSIVE","{public}","SELECT","(status = 'active'::product_content_status)",null],["product_custom_dropdown_options","Public can read enabled product custom dropdown options","PERMISSIVE","{public}","SELECT","((is_enabled = true) AND (EXISTS ( SELECT 1\n   FROM product_custom_dropdowns dropdown\n  WHERE ((dropdown.id = product_custom_dropdown_options.dropdown_id) AND (dropdown.is_enabled = true)))))",null],["product_custom_dropdowns","Public can read enabled product custom dropdowns","PERMISSIVE","{public}","SELECT","(is_enabled = true)",null],["product_metal_selections","product metal selections admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["product_metal_selections","product metal selections public read","PERMISSIVE","{public}","SELECT","(EXISTS ( SELECT 1\n   FROM products p\n  WHERE ((p.id = product_metal_selections.product_id) AND (p.status = 'active'::product_status))))",null],["products","products admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["products","products public read","PERMISSIVE","{public}","SELECT","(status = 'active'::product_status)",null],["promotion_popup","promotion popup admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["promotion_popup","promotion popup public read","PERMISSIVE","{public}","SELECT","true",null],["promotion_popup_questions","Public can view active promotion questions","PERMISSIVE","{anon,authenticated}","SELECT","((is_active = true) AND (EXISTS ( SELECT 1\n   FROM promotion_popup p\n  WHERE ((p.id = promotion_popup_questions.promotion_id) AND (p.is_active = true)))))",null],["site_settings","site settings admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["site_settings","site settings public read","PERMISSIVE","{public}","SELECT","true",null],["stats_strip_items","stats strip admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["stats_strip_items","stats strip public read","PERMISSIVE","{public}","SELECT","true",null],["support_announcement_bar","support announcement bar admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["support_announcement_bar","support announcement bar public read","PERMISSIVE","{public}","SELECT","true",null],["support_announcement_bar_items","support announcement items admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["support_announcement_bar_items","support announcement items public read","PERMISSIVE","{public}","SELECT","true",null],["support_faq_categories","faq categories admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["support_faq_categories","faq categories public read","PERMISSIVE","{public}","SELECT","(is_active = true)",null],["support_faq_items","support faq items admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["support_faq_items","support faq items public read","PERMISSIVE","{public}","SELECT","true",null],["support_faq_section","support faq section admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["support_faq_section","support faq section public read","PERMISSIVE","{public}","SELECT","true",null],["testimonials_items","testimonials items admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["testimonials_items","testimonials items public read","PERMISSIVE","{public}","SELECT","true",null],["testimonials_section","testimonials admin write","PERMISSIVE","{public}","ALL","is_admin()","is_admin()"],["testimonials_section","testimonials public read","PERMISSIVE","{public}","SELECT","true",null]]$f2_expected$::jsonb;
  actual_policies jsonb;
  table_name text;
  requirement record;
  role_state record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hod_app')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'F2 role state changed';
  END IF;
  SELECT rolsuper, rolbypassrls INTO role_state FROM pg_roles WHERE rolname = 'hod_app';
  IF role_state.rolsuper OR role_state.rolbypassrls
     OR pg_has_role('hod_app', 'authenticated', 'MEMBER')
     OR NOT has_schema_privilege('hod_app', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'hod_app role privileges/membership differ from reviewed design';
  END IF;
  IF to_regnamespace('auth') IS NOT NULL
     AND has_schema_privilege('hod_app', 'auth', 'USAGE') THEN
    RAISE EXCEPTION 'hod_app unexpectedly has auth schema USAGE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='is_admin'
      AND pg_get_function_identity_arguments(p.oid)=''
      AND pg_get_userbyid(p.proowner)='hod_migration'
      AND NOT p.prosecdef
      AND position('auth.uid()' in pg_get_functiondef(p.oid))>0
  ) THEN
    RAISE EXCEPTION 'legacy public.is_admin() definition/owner changed';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'about_founders', 'about_hero', 'about_timeline', 'about_values', 'about_wide_banner', 'bespoke_form_carat_options', 'bespoke_form_guarantees', 'bespoke_form_metal_options', 'bespoke_form_piece_types', 'bespoke_form_settings', 'bespoke_form_stone_options', 'bespoke_hero_content', 'bespoke_hero_slider_items', 'bespoke_portfolio_categories', 'bespoke_portfolio_items', 'bespoke_process_cards', 'bespoke_process_steps', 'blog_page_hero', 'blog_post_content_blocks', 'blog_post_products', 'blog_post_tags', 'blog_posts', 'catalog_categories', 'catalog_certificates', 'catalog_gst_slabs', 'catalog_material_values', 'catalog_metals', 'catalog_options', 'catalog_ring_categories', 'catalog_ring_category_sizes', 'catalog_stone_shapes', 'catalog_styles', 'catalog_subcategories', 'certifications_items', 'certifications_section', 'cms_home_bestseller_products', 'cms_home_bestsellers', 'collection_items', 'collection_page_config', 'contact_hero', 'contact_info', 'couples_items', 'couples_section', 'coupons', 'diamond_info_config', 'diamond_info_feature_items', 'discover_shapes_items', 'docs_blocks', 'docs_pages', 'education_page_hero', 'education_post_content_blocks', 'education_post_products', 'education_post_tags', 'education_posts', 'hiphop_hero_content', 'hiphop_hero_slider_items', 'hiphop_showcase_section', 'home_bespoke_showcase_section', 'home_instagram_reels', 'home_instagram_reels_section', 'homepage_hero', 'homepage_hero_slider_items', 'homepage_shop_by_category', 'homepage_shop_by_category_items', 'material_strip_items', 'metal_composition_parts', 'navbar_featured_cards', 'navbar_items', 'navbar_section_links', 'navbar_section_source_items', 'navbar_sections', 'product_content_rules', 'product_custom_dropdown_options', 'product_custom_dropdowns', 'product_faq_items', 'product_material_value_selections', 'product_metal_media', 'product_metal_selections', 'product_metal_variants', 'product_option_links', 'product_purity_prices', 'product_stone_shapes', 'product_subcategory_links', 'product_variant_media_items', 'products', 'promotion_popup', 'promotion_popup_questions', 'service_banner_blocks', 'service_banner_section', 'site_settings', 'stats_strip_items', 'support_announcement_bar', 'support_announcement_bar_items', 'support_faq_categories', 'support_faq_items', 'support_faq_section', 'testimonial_marquee', 'testimonial_marquee_items', 'testimonials_items', 'testimonials_section'
  ] LOOP
    -- These six legacy sections are explicitly out of F2 scope. The existing
    -- API routes remain unchanged, but no RDS read access is added for them.
    IF table_name = ANY(ARRAY[
      'diamond_info_config', 'diamond_info_feature_items',
      'hiphop_hero_content', 'hiphop_hero_slider_items',
      'testimonial_marquee', 'testimonial_marquee_items'
    ]) THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=table_name
        AND c.relkind IN ('r','p') AND c.relrowsecurity AND NOT c.relforcerowsecurity
    ) THEN
      RAISE EXCEPTION 'F2 table/RLS state changed: %', table_name;
    END IF;
    IF NOT has_table_privilege('hod_app', format('public.%I',table_name), 'SELECT') THEN
      RAISE EXCEPTION 'hod_app SELECT grant changed: %', table_name;
    END IF;
  END LOOP;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_array(p.tablename,p.policyname,p.permissive,p.roles::text,
                      p.cmd,p.qual,p.with_check)
    ORDER BY p.tablename COLLATE "C",p.policyname COLLATE "C"
  ), '[]'::jsonb) INTO actual_policies
  FROM pg_policies p WHERE p.schemaname='public'
    AND p.tablename <> ALL (ARRAY[
      'diamond_info_config', 'diamond_info_feature_items',
      'hiphop_hero_content', 'hiphop_hero_slider_items',
      'testimonial_marquee', 'testimonial_marquee_items'
    ])
    AND p.tablename = ANY(ARRAY['about_founders', 'about_hero', 'about_timeline', 'about_values', 'about_wide_banner', 'bespoke_form_carat_options', 'bespoke_form_guarantees', 'bespoke_form_metal_options', 'bespoke_form_piece_types', 'bespoke_form_settings', 'bespoke_form_stone_options', 'bespoke_hero_content', 'bespoke_hero_slider_items', 'bespoke_portfolio_categories', 'bespoke_portfolio_items', 'bespoke_process_cards', 'bespoke_process_steps', 'blog_page_hero', 'blog_post_content_blocks', 'blog_post_products', 'blog_post_tags', 'blog_posts', 'catalog_categories', 'catalog_certificates', 'catalog_gst_slabs', 'catalog_material_values', 'catalog_metals', 'catalog_options', 'catalog_ring_categories', 'catalog_ring_category_sizes', 'catalog_stone_shapes', 'catalog_styles', 'catalog_subcategories', 'certifications_items', 'certifications_section', 'cms_home_bestseller_products', 'cms_home_bestsellers', 'collection_items', 'collection_page_config', 'contact_hero', 'contact_info', 'couples_items', 'couples_section', 'coupons', 'diamond_info_config', 'diamond_info_feature_items', 'discover_shapes_items', 'docs_blocks', 'docs_pages', 'education_page_hero', 'education_post_content_blocks', 'education_post_products', 'education_post_tags', 'education_posts', 'hiphop_hero_content', 'hiphop_hero_slider_items', 'hiphop_showcase_section', 'home_bespoke_showcase_section', 'home_instagram_reels', 'home_instagram_reels_section', 'homepage_hero', 'homepage_hero_slider_items', 'homepage_shop_by_category', 'homepage_shop_by_category_items', 'material_strip_items', 'metal_composition_parts', 'navbar_featured_cards', 'navbar_items', 'navbar_section_links', 'navbar_section_source_items', 'navbar_sections', 'product_content_rules', 'product_custom_dropdown_options', 'product_custom_dropdowns', 'product_faq_items', 'product_material_value_selections', 'product_metal_media', 'product_metal_selections', 'product_metal_variants', 'product_option_links', 'product_purity_prices', 'product_stone_shapes', 'product_subcategory_links', 'product_variant_media_items', 'products', 'promotion_popup', 'promotion_popup_questions', 'service_banner_blocks', 'service_banner_section', 'site_settings', 'stats_strip_items', 'support_announcement_bar', 'support_announcement_bar_items', 'support_faq_categories', 'support_faq_items', 'support_faq_section', 'testimonial_marquee', 'testimonial_marquee_items', 'testimonials_items', 'testimonials_section']);
  IF actual_policies IS DISTINCT FROM expected_policies THEN
    RAISE EXCEPTION 'F2 policy state differs from reviewed export/F2-A result; abort';
  END IF;

  -- Predicate columns for formerly policy-free tables must exist.
  FOR requirement IN SELECT * FROM (VALUES
    ('blog_post_content_blocks','post_id'),
    ('blog_post_products','post_id'),
    ('catalog_gst_slabs','status'),
    ('catalog_material_values','status'),
    ('catalog_ring_categories','status'),
    ('catalog_ring_category_sizes','status'),
    ('collection_page_config','section_key'),
    ('discover_shapes_items','status'),
    ('home_bespoke_showcase_section','section_key'),
    ('product_faq_items','product_id'),
    ('product_faq_items','is_active'),
    ('product_material_value_selections','product_id'),
    ('product_metal_media','product_id'),
    ('product_metal_variants','product_id'),
    ('product_option_links','product_id'),
    ('product_purity_prices','product_id'),
    ('product_stone_shapes','product_id'),
    ('product_subcategory_links','product_id'),
    ('product_variant_media_items','product_id'),
    ('service_banner_blocks','is_active'),
    ('service_banner_section','id'),
    ('service_banner_section','is_enabled')
  ) AS v(table_name,column_name) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid=format('public.%I',requirement.table_name)::regclass
        AND a.attname=requirement.column_name AND a.attnum>0 AND NOT a.attisdropped
    ) THEN
      RAISE EXCEPTION 'F2 predicate column changed: %.%', requirement.table_name, requirement.column_name;
    END IF;
  END LOOP;

  -- Parent-derived predicates require real child-to-parent foreign keys.
  FOR requirement IN SELECT * FROM (VALUES
    ('blog_post_content_blocks','post_id','blog_posts'),
    ('blog_post_products','post_id','blog_posts'),
    ('product_faq_items','product_id','products'),
    ('product_material_value_selections','product_id','products'),
    ('product_metal_media','product_id','products'),
    ('product_metal_variants','product_id','products'),
    ('product_option_links','product_id','products'),
    ('product_purity_prices','product_id','products'),
    ('product_stone_shapes','product_id','products'),
    ('product_subcategory_links','product_id','products'),
    ('product_variant_media_items','product_id','products')
  ) AS v(child_table,child_column,parent_table) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint k
      JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=ANY(k.conkey)
      WHERE k.contype='f'
        AND k.conrelid=format('public.%I',requirement.child_table)::regclass
        AND k.confrelid=format('public.%I',requirement.parent_table)::regclass
        AND a.attname=requirement.child_column
    ) THEN
      RAISE EXCEPTION 'F2 parent FK missing/changed: %.% -> %',
        requirement.child_table,requirement.child_column,requirement.parent_table;
    END IF;
  END LOOP;
END $f2_master_preflight$;

-- Navbar
-- navbar_featured_cards: app/[categorySlug]/CategoryCollectionPageContent.tsx, lib/navbar-server.ts
ALTER POLICY "navbar featured cards admin write" ON public.navbar_featured_cards TO authenticated;
-- navbar_items: app/[categorySlug]/CategoryCollectionPageContent.tsx, lib/navbar-server.ts
ALTER POLICY "navbar items admin write" ON public.navbar_items TO authenticated;
CREATE POLICY hod_app_f2_hidden_bespoke_navbar ON public.navbar_items FOR SELECT TO hod_app USING (slug = 'bespoke' AND status = 'hidden'::navbar_status);
-- navbar_section_links: app/[categorySlug]/CategoryCollectionPageContent.tsx, lib/navbar-server.ts
ALTER POLICY "navbar section links admin write" ON public.navbar_section_links TO authenticated;
-- navbar_section_source_items: app/[categorySlug]/CategoryCollectionPageContent.tsx, lib/navbar-server.ts
ALTER POLICY "navbar section source items admin write" ON public.navbar_section_source_items TO authenticated;
-- navbar_sections: app/[categorySlug]/CategoryCollectionPageContent.tsx, lib/navbar-server.ts
ALTER POLICY "Admin can read navbar_sections" ON public.navbar_sections TO authenticated;
ALTER POLICY "navbar sections admin write" ON public.navbar_sections TO authenticated;

-- Products/catalog
-- catalog_certificates: app/[categorySlug]/CategoryCollectionPageContent.tsx, lib/catalog-products.ts, lib/navbar-server.ts
CREATE POLICY hod_app_f2_read_catalog_certificates ON public.catalog_certificates FOR SELECT TO hod_app USING (true);
-- catalog_gst_slabs: lib/catalog-products.ts
CREATE POLICY hod_app_f2_read_catalog_gst_slabs ON public.catalog_gst_slabs FOR SELECT TO hod_app USING (status <> 'hidden');
-- catalog_material_values: lib/catalog-products.ts, lib/home-data.ts
CREATE POLICY hod_app_f2_read_catalog_material_values ON public.catalog_material_values FOR SELECT TO hod_app USING (status = 'active');
-- catalog_metals: app/[categorySlug]/CategoryCollectionPageContent.tsx, lib/catalog-products.ts, lib/home-data.ts, lib/navbar-server.ts
ALTER POLICY "catalog metals admin write" ON public.catalog_metals TO authenticated;
-- catalog_ring_categories: lib/catalog-products.ts
CREATE POLICY hod_app_f2_read_catalog_ring_categories ON public.catalog_ring_categories FOR SELECT TO hod_app USING (status = 'active');
-- catalog_ring_category_sizes: lib/catalog-products.ts
CREATE POLICY hod_app_f2_read_catalog_ring_category_sizes ON public.catalog_ring_category_sizes FOR SELECT TO hod_app USING (status = 'active');
-- catalog_stone_shapes: app/[categorySlug]/CategoryCollectionPageContent.tsx, lib/catalog-products.ts, lib/home-data.ts, lib/navbar-server.ts
ALTER POLICY "catalog stone shapes admin write" ON public.catalog_stone_shapes TO authenticated;
-- catalog_styles: app/[categorySlug]/CategoryCollectionPageContent.tsx, lib/catalog-products.ts, lib/navbar-server.ts
ALTER POLICY "catalog styles admin write" ON public.catalog_styles TO authenticated;
-- metal_composition_parts: lib/catalog-products.ts
CREATE POLICY hod_app_f2_read_metal_composition_parts ON public.metal_composition_parts FOR SELECT TO hod_app USING (true);
-- product_content_rules: lib/catalog-products.ts
ALTER POLICY "product content rules admin write" ON public.product_content_rules TO authenticated;
-- product_faq_items: lib/catalog-products.ts
CREATE POLICY hod_app_f2_read_product_faq_items ON public.product_faq_items FOR SELECT TO hod_app USING (is_active = true AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_faq_items.product_id AND p.status = 'active'::product_status));
-- product_material_value_selections: lib/catalog-products.ts, lib/home-data.ts
CREATE POLICY hod_app_f2_read_product_material_value_selections ON public.product_material_value_selections FOR SELECT TO hod_app USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_material_value_selections.product_id AND p.status = 'active'::product_status));
-- product_metal_media: lib/catalog-products.ts, lib/home-data.ts
CREATE POLICY hod_app_f2_read_product_metal_media ON public.product_metal_media FOR SELECT TO hod_app USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_metal_media.product_id AND p.status = 'active'::product_status));
-- product_metal_selections: lib/catalog-products.ts, lib/home-data.ts
ALTER POLICY "product metal selections admin write" ON public.product_metal_selections TO authenticated;
-- product_metal_variants: lib/catalog-products.ts, lib/home-data.ts
CREATE POLICY hod_app_f2_read_product_metal_variants ON public.product_metal_variants FOR SELECT TO hod_app USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_metal_variants.product_id AND p.status = 'active'::product_status));
-- product_option_links: lib/catalog-products.ts
CREATE POLICY hod_app_f2_read_product_option_links ON public.product_option_links FOR SELECT TO hod_app USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_option_links.product_id AND p.status = 'active'::product_status));
-- product_purity_prices: lib/catalog-products.ts
CREATE POLICY hod_app_f2_read_product_purity_prices ON public.product_purity_prices FOR SELECT TO hod_app USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_purity_prices.product_id AND p.status = 'active'::product_status));
-- product_stone_shapes: lib/catalog-products.ts
CREATE POLICY hod_app_f2_read_product_stone_shapes ON public.product_stone_shapes FOR SELECT TO hod_app USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_stone_shapes.product_id AND p.status = 'active'::product_status));
-- product_subcategory_links: lib/catalog-products.ts
CREATE POLICY hod_app_f2_read_product_subcategory_links ON public.product_subcategory_links FOR SELECT TO hod_app USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_subcategory_links.product_id AND p.status = 'active'::product_status));
-- product_variant_media_items: lib/catalog-products.ts, lib/home-data.ts
CREATE POLICY hod_app_f2_read_product_variant_media_items ON public.product_variant_media_items FOR SELECT TO hod_app USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variant_media_items.product_id AND p.status = 'active'::product_status));
-- products: lib/catalog-products.ts, lib/home-data.ts
ALTER POLICY "products admin write" ON public.products TO authenticated;

-- Homepage/CMS
-- certifications_items: app/api/public\certifications\route.ts
ALTER POLICY "certifications items admin write" ON public.certifications_items TO authenticated;
-- certifications_section: app/api/public\certifications\route.ts
ALTER POLICY "certifications section admin write" ON public.certifications_section TO authenticated;
-- cms_home_bestseller_products: lib/home-data.ts
ALTER POLICY "cms home bestseller products admin write" ON public.cms_home_bestseller_products TO authenticated;
-- cms_home_bestsellers: lib/home-data.ts
ALTER POLICY "cms home bestsellers admin write" ON public.cms_home_bestsellers TO authenticated;
-- collection_items: app/api/public\collection\route.ts, lib/home-data.ts
ALTER POLICY "collection admin write" ON public.collection_items TO authenticated;
-- collection_page_config: lib/home-data.ts
CREATE POLICY hod_app_f2_read_collection_page_config ON public.collection_page_config FOR SELECT TO hod_app USING (section_key = 'main_collection_page');
-- couples_items: app/api/public\couples\route.ts
ALTER POLICY "couples items admin write" ON public.couples_items TO authenticated;
-- couples_section: app/api/public\couples\route.ts
ALTER POLICY "couples admin write" ON public.couples_section TO authenticated;
-- discover_shapes_items: lib/home-data.ts
CREATE POLICY hod_app_f2_read_discover_shapes_items ON public.discover_shapes_items FOR SELECT TO hod_app USING (status = 'active');
-- hiphop_showcase_section: app/api/public\hiphop-showcase\route.ts, lib/hiphop-hero.ts, lib/home-data.ts
ALTER POLICY "hiphop showcase admin write" ON public.hiphop_showcase_section TO authenticated;
-- home_bespoke_showcase_section: lib/home-data.ts
CREATE POLICY hod_app_f2_read_home_bespoke_showcase_section ON public.home_bespoke_showcase_section FOR SELECT TO hod_app USING (section_key = 'home_bespoke_showcase');
-- home_instagram_reels: lib/home-data.ts
ALTER POLICY "instagram reels admin access" ON public.home_instagram_reels TO authenticated;
-- home_instagram_reels_section: lib/home-data.ts
ALTER POLICY "instagram section admin access" ON public.home_instagram_reels_section TO authenticated;
-- homepage_hero_slider_items: lib/home-data.ts
ALTER POLICY "hero slider admin write" ON public.homepage_hero_slider_items TO authenticated;
-- homepage_shop_by_category: lib/shop-by-category.ts
ALTER POLICY "Public can read enabled shop by category section" ON public.homepage_shop_by_category TO anon, authenticated, hod_app;
-- homepage_shop_by_category_items: lib/shop-by-category.ts
ALTER POLICY "Public can read active shop by category items" ON public.homepage_shop_by_category_items TO anon, authenticated, hod_app;
-- material_strip_items: app/api/public\material-strip\route.ts
ALTER POLICY "material strip admin write" ON public.material_strip_items TO authenticated;
-- service_banner_blocks: app/api/public\service-banner\route.ts, app/shop/[slug]/page.tsx
CREATE POLICY hod_app_f2_read_service_banner_blocks ON public.service_banner_blocks FOR SELECT TO hod_app USING (is_active = true);
-- service_banner_section: app/api/public\service-banner\route.ts, app/shop/[slug]/page.tsx
CREATE POLICY hod_app_f2_read_service_banner_section ON public.service_banner_section FOR SELECT TO hod_app USING (id = 1 AND is_enabled = true);
-- stats_strip_items: app/api/public\stats\route.ts
ALTER POLICY "stats strip admin write" ON public.stats_strip_items TO authenticated;

-- Blog/education
-- blog_page_hero: lib/blog.ts
ALTER POLICY "Public can read blog page hero" ON public.blog_page_hero TO anon, authenticated, hod_app;
-- blog_post_content_blocks: lib/blog.ts
CREATE POLICY hod_app_f2_read_blog_post_content_blocks ON public.blog_post_content_blocks FOR SELECT TO hod_app USING (EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = blog_post_content_blocks.post_id AND p.is_published = true));
-- blog_post_products: lib/blog.ts
CREATE POLICY hod_app_f2_read_blog_post_products ON public.blog_post_products FOR SELECT TO hod_app USING (EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = blog_post_products.post_id AND p.is_published = true));
-- blog_post_tags: lib/blog.ts
ALTER POLICY "blog tags admin write" ON public.blog_post_tags TO authenticated;
-- blog_posts: lib/blog.ts, lib/home-data.ts
ALTER POLICY "blog posts admin write" ON public.blog_posts TO authenticated;
-- education_page_hero: lib/education.ts
ALTER POLICY "Public can read education hero" ON public.education_page_hero TO anon, authenticated, hod_app;
-- education_post_content_blocks: lib/education.ts
ALTER POLICY "education_blocks_public_read" ON public.education_post_content_blocks TO anon, authenticated, hod_app;
-- education_post_products: lib/education.ts
ALTER POLICY "education_products_public_read" ON public.education_post_products TO anon, authenticated, hod_app;
-- education_post_tags: lib/education.ts
ALTER POLICY "education_tags_public_read" ON public.education_post_tags TO anon, authenticated, hod_app;
-- education_posts: lib/education.ts
ALTER POLICY "education_posts_public_read" ON public.education_posts TO anon, authenticated, hod_app;

-- Bespoke
-- bespoke_form_carat_options: app/api/public/bespoke/form-config/route.ts, app/bespoke/page.tsx
ALTER POLICY "bespoke carat options admin write" ON public.bespoke_form_carat_options TO authenticated;
-- bespoke_form_guarantees: app/api/public/bespoke/form-config/route.ts, app/bespoke/page.tsx
ALTER POLICY "bespoke guarantees admin write" ON public.bespoke_form_guarantees TO authenticated;
-- bespoke_form_metal_options: app/api/public/bespoke/form-config/route.ts, app/bespoke/page.tsx
ALTER POLICY "bespoke metal options admin write" ON public.bespoke_form_metal_options TO authenticated;
-- bespoke_form_piece_types: app/api/public/bespoke/form-config/route.ts, app/bespoke/page.tsx
ALTER POLICY "bespoke piece types admin write" ON public.bespoke_form_piece_types TO authenticated;
-- bespoke_form_settings: app/api/public\bespoke\form-config\route.ts, app/bespoke/page.tsx
ALTER POLICY "bespoke form settings admin write" ON public.bespoke_form_settings TO authenticated;
-- bespoke_form_stone_options: app/api/public/bespoke/form-config/route.ts, app/bespoke/page.tsx
ALTER POLICY "bespoke stone options admin write" ON public.bespoke_form_stone_options TO authenticated;
-- bespoke_hero_content: app/api/public\bespoke\hero\route.ts, app/bespoke/page.tsx
ALTER POLICY "bespoke hero admin write" ON public.bespoke_hero_content TO authenticated;
-- bespoke_hero_slider_items: app/api/public\bespoke\hero\route.ts, app/bespoke/page.tsx
CREATE POLICY hod_app_f2_read_bespoke_hero_slider_items ON public.bespoke_hero_slider_items FOR SELECT TO hod_app USING (true);
-- bespoke_portfolio_categories: app/api/public\bespoke\portfolio\route.ts, app/bespoke/page.tsx
ALTER POLICY "bespoke portfolio categories admin write" ON public.bespoke_portfolio_categories TO authenticated;
-- bespoke_process_cards: app/api/public\bespoke\process\route.ts, app/bespoke/page.tsx
ALTER POLICY "bespoke process cards admin write" ON public.bespoke_process_cards TO authenticated;
-- bespoke_process_steps: app/api/public\bespoke\manufacturing\route.ts
ALTER POLICY "bespoke process admin write" ON public.bespoke_process_steps TO authenticated;

-- Settings/support/about
-- about_founders: app/about/page.tsx, app/api/public\about\founders\route.ts
ALTER POLICY "about founders admin write" ON public.about_founders TO authenticated;
-- about_hero: app/about/page.tsx, app/api/public\about\hero\route.ts
ALTER POLICY "Public can read about hero" ON public.about_hero TO anon, authenticated, hod_app;
-- about_timeline: app/about/page.tsx, app/api/public\about\timeline\route.ts
ALTER POLICY "about timeline admin write" ON public.about_timeline TO authenticated;
-- about_values: app/about/page.tsx, app/api/public\about\values\route.ts
ALTER POLICY "about values admin write" ON public.about_values TO authenticated;
-- about_wide_banner: app/about/page.tsx, app/api/public\about\wide-banner\route.ts
ALTER POLICY "Public can read about wide banner" ON public.about_wide_banner TO anon, authenticated, hod_app;
-- contact_hero: app/api/public\contact\hero\route.ts
ALTER POLICY "contact hero admin write" ON public.contact_hero TO authenticated;
-- contact_info: app/api/public\contact\info\route.ts, app/returns/page.tsx
ALTER POLICY "contact info admin write" ON public.contact_info TO authenticated;
-- docs_blocks: lib/docs-pages.ts
ALTER POLICY "docs blocks admin write" ON public.docs_blocks TO authenticated;
-- docs_pages: lib/docs-pages.ts
ALTER POLICY "docs pages admin write" ON public.docs_pages TO authenticated;
-- site_settings: app/api/public/settings/route.ts, app/api/public\settings\route.ts, lib/docs-pages.ts, lib/maintenance.ts
ALTER POLICY "site settings admin write" ON public.site_settings TO authenticated;
-- support_announcement_bar: app/api/public\announcement-bar\route.ts
ALTER POLICY "support announcement bar admin write" ON public.support_announcement_bar TO authenticated;
-- support_announcement_bar_items: app/api/public\announcement-bar\route.ts
ALTER POLICY "support announcement items admin write" ON public.support_announcement_bar_items TO authenticated;
-- support_faq_categories: app/faq/page.tsx
ALTER POLICY "faq categories admin write" ON public.support_faq_categories TO authenticated;
-- support_faq_items: app/[categorySlug]/CategoryCollectionPageContent.tsx, app/faq/page.tsx
ALTER POLICY "support faq items admin write" ON public.support_faq_items TO authenticated;
-- support_faq_section: app/faq/page.tsx
ALTER POLICY "support faq section admin write" ON public.support_faq_section TO authenticated;

-- Testimonials
-- testimonials_items: app/api/public\testimonials\route.ts, lib/home-data.ts
ALTER POLICY "testimonials items admin write" ON public.testimonials_items TO authenticated;
-- testimonials_section: app/api/public\testimonials\route.ts, lib/home-data.ts
ALTER POLICY "testimonials admin write" ON public.testimonials_section TO authenticated;

-- Promotions
-- coupons: app/api/public\promotion-popup\offer\route.ts, app/api/public\promotions\route.ts, app/page.tsx, app/shop/[slug]/page.tsx
ALTER POLICY "coupons admin write" ON public.coupons TO authenticated;
-- promotion_popup: app/api/public\promotion-popup\offer\route.ts, app/api/public\promotion-popup\route.ts
ALTER POLICY "promotion popup admin write" ON public.promotion_popup TO authenticated;
-- promotion_popup_questions: app/api/public\promotion-popup\route.ts
ALTER POLICY "Public can view active promotion questions" ON public.promotion_popup_questions TO anon, authenticated, hod_app;

COMMIT;
