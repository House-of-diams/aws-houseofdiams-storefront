import 'server-only'

import { query } from '@/lib/db/query'

type TestimonialMarquee = { id: number; title: string }
type TestimonialMarqueeItem = {
  id: number
  sort_order: number
  quote: string
  author: string
}

export async function findHomeTestimonialMarquee(): Promise<TestimonialMarquee | null> {
  const result = await query<{ row: TestimonialMarquee }>(
    `SELECT jsonb_build_object('id', id, 'title', title) AS row
     FROM public.testimonial_marquee WHERE section_key = $1 LIMIT 1`,
    ['home_testimonial_marquee'],
    { operation: 'cms.testimonial_marquee' },
  )
  return result.rows[0]?.row ?? null
}

export async function listTestimonialMarqueeItems(marqueeId: number): Promise<TestimonialMarqueeItem[]> {
  const result = await query<{ row: TestimonialMarqueeItem }>(
    `SELECT jsonb_build_object(
       'id', id, 'sort_order', sort_order, 'quote', quote, 'author', author
     ) AS row FROM public.testimonial_marquee_items
     WHERE marquee_id = $1 ORDER BY sort_order ASC`,
    [marqueeId],
    { operation: 'cms.testimonial_marquee_items' },
  )
  return result.rows.map((entry) => entry.row)
}

type CmsRow = Record<string, unknown>

async function cmsRows(sql: string, values: readonly unknown[], operation: string) {
  const result = await query<{ row: CmsRow }>(sql, values, { operation })
  return result.rows.map(({ row }) => row)
}

async function cmsOne(sql: string, values: readonly unknown[], operation: string) {
  const data = await cmsRows(sql, values, operation)
  if (data.length > 1) throw new Error(`Expected one CMS row for ${operation}.`)
  return { data: data[0] ?? null, error: null as { code?: string; message: string } | null }
}

function cmsMany(data: CmsRow[]) {
  return { data, error: null as { code?: string; message: string } | null }
}

export async function loadHomeCmsRowsFromRds() {
  const [hero, blog, collection, discoverShapes, stoneShapes, hiphop,
    collectionConfig, bespoke, testimonials, bestSellerSection, bestSellerSelections] = await Promise.all([
      cmsOne('SELECT to_jsonb(t) AS row FROM public.homepage_hero t WHERE section_key = $1 AND is_active = $2 LIMIT 2', ['home_hero', true], 'cms.home.hero'),
      cmsRows(`SELECT to_jsonb(p) || jsonb_build_object('blog_post_tags',
              COALESCE((SELECT jsonb_agg(jsonb_build_object('tag', t.tag, 'sort_order', t.sort_order) ORDER BY t.sort_order)
                        FROM public.blog_post_tags t WHERE t.post_id = p.id), '[]'::jsonb)) AS row
              FROM public.blog_posts p WHERE is_published = $1 ORDER BY sort_order ASC`, [true], 'cms.home.blog'),
      cmsRows('SELECT to_jsonb(t) AS row FROM public.collection_items t ORDER BY sort_order ASC', [], 'cms.home.collection'),
      cmsRows('SELECT to_jsonb(t) AS row FROM public.discover_shapes_items t WHERE status = $1 ORDER BY sort_order ASC', ['active'], 'cms.home.discover_shapes'),
      cmsRows('SELECT to_jsonb(t) AS row FROM public.catalog_stone_shapes t WHERE status = $1 ORDER BY display_order ASC', ['active'], 'cms.home.stone_shapes'),
      cmsOne('SELECT to_jsonb(t) AS row FROM public.hiphop_showcase_section t WHERE section_key = $1 LIMIT 2', ['home_hiphop_showcase'], 'cms.home.hiphop'),
      cmsOne('SELECT to_jsonb(t) AS row FROM public.collection_page_config t WHERE section_key = $1 LIMIT 2', ['main_collection_page'], 'cms.home.collection_config'),
      cmsOne('SELECT to_jsonb(t) AS row FROM public.home_bespoke_showcase_section t WHERE section_key = $1 LIMIT 2', ['home_bespoke_showcase'], 'cms.home.bespoke'),
      cmsOne('SELECT to_jsonb(t) AS row FROM public.testimonials_section t WHERE section_key = $1 LIMIT 2', ['home_testimonials'], 'cms.home.testimonials'),
      cmsOne('SELECT to_jsonb(t) AS row FROM public.cms_home_bestsellers t WHERE status = $1 LIMIT 2', ['active'], 'cms.home.bestsellers'),
      cmsRows('SELECT to_jsonb(t) AS row FROM public.cms_home_bestseller_products t ORDER BY display_order ASC', [], 'cms.home.bestseller_products'),
    ])
  return [hero, cmsMany(blog), cmsMany(collection), cmsMany(discoverShapes), cmsMany(stoneShapes),
    hiphop, collectionConfig, bespoke, testimonials, bestSellerSection, cmsMany(bestSellerSelections)] as const
}

export async function loadHomeHeroSliderRowsFromRds(heroId: number) {
  return cmsMany(await cmsRows(
    `SELECT jsonb_build_object(
       'sort_order', sort_order, 'image_path', image_path, 'mobile_image_path', mobile_image_path,
       'headline', headline, 'subtitle', subtitle, 'button_text', button_text, 'button_link', button_link
     ) AS row FROM public.homepage_hero_slider_items WHERE hero_id = $1 ORDER BY sort_order ASC`,
    [heroId], 'cms.home.hero_slides',
  ))
}

export async function loadHomeTestimonialsRowsFromRds(sectionId: number) {
  return cmsMany(await cmsRows(
    'SELECT to_jsonb(t) AS row FROM public.testimonials_items t WHERE section_id = $1 ORDER BY sort_order ASC',
    [sectionId], 'cms.home.testimonials_items',
  ))
}

export async function loadHomeBestSellerRowsFromRds(productIds: string[]) {
  const [products, selections, metals, media, materialSelections, materialValues, variants, variantMedia] = await Promise.all([
    cmsRows(`SELECT to_jsonb(p) || jsonb_build_object(
              'subcategory', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('name', s.name) END,
              'option', CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object('name', o.name) END,
              'category', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('name', c.name) END) AS row
              FROM public.products p
              LEFT JOIN public.catalog_subcategories s ON s.id = p.subcategory_id
              LEFT JOIN public.catalog_options o ON o.id = p.option_id
              LEFT JOIN public.catalog_categories c ON c.id = p.main_category_id
              WHERE p.id = ANY($1::uuid[]) AND p.status = $2`, [productIds, 'active'], 'cms.home.bestseller.product_rows'),
    cmsRows('SELECT to_jsonb(t) AS row FROM public.product_metal_selections t WHERE product_id = ANY($1::uuid[]) ORDER BY sort_order ASC', [productIds], 'cms.home.bestseller.metal_selections'),
    cmsRows('SELECT to_jsonb(t) AS row FROM public.catalog_metals t WHERE status = $1 ORDER BY display_order ASC', ['active'], 'cms.home.bestseller.metals'),
    cmsRows('SELECT to_jsonb(t) AS row FROM public.product_metal_media t WHERE product_id = ANY($1::uuid[])', [productIds], 'cms.home.bestseller.media'),
    cmsRows('SELECT to_jsonb(t) AS row FROM public.product_material_value_selections t WHERE product_id = ANY($1::uuid[]) ORDER BY sort_order ASC', [productIds], 'cms.home.bestseller.material_selections'),
    cmsRows('SELECT to_jsonb(t) AS row FROM public.catalog_material_values t WHERE status = $1 ORDER BY display_order ASC', ['active'], 'cms.home.bestseller.material_values'),
    cmsRows('SELECT to_jsonb(t) AS row FROM public.product_metal_variants t WHERE product_id = ANY($1::uuid[]) ORDER BY sort_order ASC', [productIds], 'cms.home.bestseller.variants'),
    cmsRows('SELECT to_jsonb(t) AS row FROM public.product_variant_media_items t WHERE product_id = ANY($1::uuid[]) ORDER BY sort_order ASC', [productIds], 'cms.home.bestseller.variant_media'),
  ])
  return [cmsMany(products), cmsMany(selections), cmsMany(metals), cmsMany(media),
  cmsMany(materialSelections), cmsMany(materialValues), cmsMany(variants), cmsMany(variantMedia)] as const
}

export async function findActiveHomeHeroRowFromRds() {
  return cmsOne(
    'SELECT to_jsonb(t) AS row FROM public.homepage_hero t WHERE section_key = $1 AND is_active = $2 LIMIT 2',
    ['home_hero', true], 'cms.home.fresh_hero',
  )
}

export async function loadHomeInstagramRowsFromRds() {
  const [section, items] = await Promise.all([
    cmsOne('SELECT to_jsonb(t) AS row FROM public.home_instagram_reels_section t WHERE section_key = $1 LIMIT 2', ['home_instagram_reels'], 'cms.home.instagram_section'),
    cmsRows('SELECT to_jsonb(t) AS row FROM public.home_instagram_reels t WHERE section_key = $1 AND is_enabled = $2 ORDER BY display_order ASC LIMIT 30', ['home_instagram_reels', true], 'cms.home.instagram_items'),
  ])
  return [section, cmsMany(items)] as const
}

export async function loadShopByCategoryRowsFromRds() {
  const sectionResult = await query<Record<string, unknown>>(
    `SELECT id, heading, shop_all_label, shop_all_link, desktop_columns, tablet_columns, mobile_columns
       FROM public.homepage_shop_by_category WHERE section_key = $1 AND is_enabled = true LIMIT 2`,
    ['home_shop_by_category'], { operation: 'cms.shop_by_category.section' },
  )
  if (sectionResult.rows.length > 1) throw new Error('Expected one shop-by-category section.')
  const section = sectionResult.rows[0]
  if (!section) return null
  const [items, categories, subcategories, options] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT id, item_type, category_id, subcategory_id, option_id, display_order
         FROM public.homepage_shop_by_category_items WHERE section_id = $1 AND is_active = true ORDER BY display_order ASC`,
      [section.id], { operation: 'cms.shop_by_category.items' },
    ),
    query<Record<string, unknown>>(
      `SELECT id, name, slug, status, banner_desktop_image_path, banner_mobile_image_path, banner_desktop_image_alt, banner_mobile_image_alt
         FROM public.catalog_categories WHERE status = 'active'`, [], { operation: 'cms.shop_by_category.categories' },
    ),
    query<Record<string, unknown>>(
      `SELECT id, category_id, name, slug, status, image_path, icon_svg_path, image_alt
         FROM public.catalog_subcategories WHERE status = 'active'`, [], { operation: 'cms.shop_by_category.subcategories' },
    ),
    query<Record<string, unknown>>(
      `SELECT id, subcategory_id, name, slug, status, image_path, icon_svg_path, image_alt
         FROM public.catalog_options WHERE status = 'active'`, [], { operation: 'cms.shop_by_category.options' },
    ),
  ])
  return { section, items: items.rows, categories: categories.rows, subcategories: subcategories.rows, options: options.rows }
}

export async function findCollectionPageConfigFromRds() {
  const result = await query<Record<string, unknown>>(
    `SELECT page_enabled, show_in_footer, showcase_cta_href, showcase_cta_label
       FROM public.collection_page_config WHERE section_key = $1 LIMIT 2`,
    ['main_collection_page'], { operation: 'cms.collection_page_config' },
  )
  if (result.rows.length > 1) throw new Error('Expected one collection page configuration.')
  return result.rows[0] ?? null
}
