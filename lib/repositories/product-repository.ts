import 'server-only'

import { query } from '@/lib/db/query'

type JsonRow = Record<string, unknown>

export type ProductReadScope = {
  slug?: string
  slugs?: string[]
  productIds?: string[]
  mainCategoryId?: string
  mainCategoryIds?: string[]
  excludeProductId?: string
  excludeProductIds?: string[]
  searchTokens?: string[]
  limit?: number
}

async function rows(sql: string, values: readonly unknown[], operation: string): Promise<JsonRow[]> {
  // PostgREST serializes PostgreSQL numeric/date/array values through JSON.
  // Keep that representation for the existing product normalization code.
  const result = await query<{ row: JsonRow }>(sql, values, { operation })
  return result.rows.map(({ row }) => row)
}

function result<T>(data: T[]) {
  return { data, error: null as { code?: string; message: string } | null }
}

export async function loadActiveProductRowsFromRds(productLane?: string, scope?: ProductReadScope) {
  return rows(
    `SELECT to_jsonb(p) AS row
       FROM public.products p
      WHERE p.status = $1
        AND ($2::text IS NULL OR p.product_lane::text = $2)
        AND ($3::text IS NULL OR p.slug = $3)
        AND ($4::text[] IS NULL OR p.slug = ANY($4::text[]))
        AND ($5::uuid[] IS NULL OR p.id = ANY($5::uuid[]))
        AND ($6::uuid IS NULL OR p.main_category_id = $6)
        AND ($7::uuid[] IS NULL OR p.main_category_id = ANY($7::uuid[]))
        AND ($8::uuid IS NULL OR p.id <> $8)
        AND p.id <> ALL($9::uuid[])
        AND NOT EXISTS (
          SELECT 1 FROM unnest($10::text[]) AS token
           WHERE p.name NOT ILIKE '%' || token || '%'
             AND p.slug NOT ILIKE '%' || token || '%'
        )
      ORDER BY p.created_at DESC
      LIMIT $11::integer`,
    [
      'active', productLane ?? null, scope?.slug ?? null, scope?.slugs ?? null,
      scope?.productIds ?? null, scope?.mainCategoryId ?? null,
      scope?.mainCategoryIds ?? null, scope?.excludeProductId ?? null,
      scope?.excludeProductIds ?? [], scope?.searchTokens ?? [], scope?.limit ?? null,
    ],
    'product.hydration.products',
  )
}

export async function loadProductHydrationRowsFromRds(scopedProductIds: string[] | null) {
  const ids = scopedProductIds
  const [
    categories, subcategories, options, metals, materialValues, certificates,
    styles, ringCategories, ringCategorySizes, contentRules, metalSelections,
    materialSelections, shapeSelections, gstSlabs, purityPrices, metalMedia,
    compositionParts, subcategoryLinks, optionLinks, metalVariants,
    variantMediaItems, faqs, customDropdowns,
  ] = await Promise.all([
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_categories t', [], 'product.categories'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_subcategories t', [], 'product.subcategories'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_options t', [], 'product.options'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_metals t', [], 'product.metals'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_material_values t WHERE status = $1 ORDER BY display_order ASC', ['active'], 'product.material_values'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_certificates t', [], 'product.certificates'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_styles t WHERE status = $1 ORDER BY display_order ASC', ['active'], 'product.styles'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_ring_categories t WHERE status = $1 ORDER BY display_order ASC', ['active'], 'product.ring_categories'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_ring_category_sizes t WHERE status = $1 ORDER BY display_order ASC', ['active'], 'product.ring_sizes'),
    rows('SELECT to_jsonb(t) AS row FROM public.product_content_rules t WHERE status = $1', ['active'], 'product.content_rules'),
    rows('SELECT to_jsonb(t) AS row FROM public.product_metal_selections t WHERE ($1::uuid[] IS NULL OR product_id = ANY($1::uuid[])) ORDER BY sort_order ASC, id ASC', [ids], 'product.metal_selections'),
    rows('SELECT to_jsonb(t) AS row FROM public.product_material_value_selections t WHERE ($1::uuid[] IS NULL OR product_id = ANY($1::uuid[])) ORDER BY sort_order ASC', [ids], 'product.material_selections'),
    rows(`SELECT jsonb_build_object('product_id', t.product_id, 'shape_id', t.shape_id,
          'shape', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', s.id, 'name', s.name, 'slug', s.slug, 'svg_asset_url', s.svg_asset_url) END) AS row
          FROM public.product_stone_shapes t
          LEFT JOIN public.catalog_stone_shapes s ON s.id = t.shape_id
          WHERE ($1::uuid[] IS NULL OR t.product_id = ANY($1::uuid[]))`, [ids], 'product.shape_selections'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_gst_slabs t WHERE status <> $1', ['hidden'], 'product.gst_slabs'),
    rows('SELECT to_jsonb(t) AS row FROM public.product_purity_prices t WHERE ($1::uuid[] IS NULL OR product_id = ANY($1::uuid[])) ORDER BY sort_order ASC', [ids], 'product.purity_prices'),
    rows('SELECT to_jsonb(t) AS row FROM public.product_metal_media t WHERE ($1::uuid[] IS NULL OR product_id = ANY($1::uuid[])) ORDER BY id ASC', [ids], 'product.metal_media'),
    rows('SELECT to_jsonb(t) AS row FROM public.metal_composition_parts t ORDER BY sort_order ASC', [], 'product.composition_parts'),
    rows('SELECT to_jsonb(t) AS row FROM public.product_subcategory_links t WHERE ($1::uuid[] IS NULL OR product_id = ANY($1::uuid[])) ORDER BY sort_order ASC', [ids], 'product.subcategory_links'),
    rows('SELECT to_jsonb(t) AS row FROM public.product_option_links t WHERE ($1::uuid[] IS NULL OR product_id = ANY($1::uuid[])) ORDER BY sort_order ASC', [ids], 'product.option_links'),
    rows('SELECT to_jsonb(t) AS row FROM public.product_metal_variants t WHERE ($1::uuid[] IS NULL OR product_id = ANY($1::uuid[])) ORDER BY sort_order ASC, id ASC', [ids], 'product.metal_variants'),
    rows('SELECT to_jsonb(t) AS row FROM public.product_variant_media_items t WHERE ($1::uuid[] IS NULL OR product_id = ANY($1::uuid[])) ORDER BY sort_order ASC, id ASC', [ids], 'product.variant_media'),
    rows('SELECT to_jsonb(t) AS row FROM public.product_faq_items t WHERE ($1::uuid[] IS NULL OR product_id = ANY($1::uuid[])) AND is_active = $2 ORDER BY sort_order ASC', [ids, true], 'product.faqs'),
    rows('SELECT to_jsonb(t) AS row FROM public.product_custom_dropdowns t WHERE ($1::uuid[] IS NULL OR product_id = ANY($1::uuid[])) AND is_enabled = $2 ORDER BY display_order ASC', [ids, true], 'product.custom_dropdowns'),
  ])

  return [
    result(categories), result(subcategories), result(options), result(metals),
    result(materialValues), result(certificates), result(styles), result(ringCategories),
    result(ringCategorySizes), result(contentRules), result(metalSelections),
    result(materialSelections), result(shapeSelections), result(gstSlabs),
    result(purityPrices), result(metalMedia), result(compositionParts),
    result(subcategoryLinks), result(optionLinks), result(metalVariants),
    result(variantMediaItems), result(faqs), result(customDropdowns),
  ] as const
}

export async function loadProductCustomDropdownOptionsFromRds(dropdownIds: string[]) {
  if (dropdownIds.length === 0) return result([])
  return result(await rows(
    'SELECT to_jsonb(t) AS row FROM public.product_custom_dropdown_options t WHERE dropdown_id = ANY($1::uuid[]) AND is_enabled = $2 ORDER BY display_order ASC',
    [dropdownIds, true], 'product.custom_dropdown_options',
  ))
}

type FilterReference = { id: string; slug: string; category_id?: string; subcategory_id?: string; name?: string; code?: string }

export async function loadProductPageReferencesFromRds() {
  const [categories, subcategories, options, shapes, metals, styles, certificates] = await Promise.all([
    rows('SELECT jsonb_build_object(\'id\', id, \'slug\', slug) AS row FROM public.catalog_categories WHERE status = $1', ['active'], 'product.page.categories'),
    rows('SELECT jsonb_build_object(\'id\', id, \'category_id\', category_id, \'slug\', slug) AS row FROM public.catalog_subcategories WHERE status = $1', ['active'], 'product.page.subcategories'),
    rows('SELECT jsonb_build_object(\'id\', id, \'subcategory_id\', subcategory_id, \'slug\', slug) AS row FROM public.catalog_options WHERE status = $1', ['active'], 'product.page.options'),
    rows('SELECT jsonb_build_object(\'id\', id, \'slug\', slug) AS row FROM public.catalog_stone_shapes WHERE status = $1', ['active'], 'product.page.shapes'),
    rows('SELECT jsonb_build_object(\'id\', id, \'slug\', slug) AS row FROM public.catalog_metals WHERE status = $1', ['active'], 'product.page.metals'),
    rows('SELECT jsonb_build_object(\'id\', id, \'slug\', slug) AS row FROM public.catalog_styles WHERE status = $1', ['active'], 'product.page.styles'),
    rows('SELECT jsonb_build_object(\'id\', id, \'name\', name, \'code\', code) AS row FROM public.catalog_certificates', [], 'product.page.certificates'),
  ])
  const asReference = (data: JsonRow[]) => result(data as FilterReference[])
  return [asReference(categories), asReference(subcategories), asReference(options), asReference(shapes), asReference(metals), asReference(styles), asReference(certificates)] as const
}

export async function loadProductPageIndexFromRds(args: {
  productLane?: string
  categoryId?: string
  subcategoryId?: string
  optionId?: string
  shapeId?: string
  metalId?: string
  styleId?: string
  certificateId?: string
  sort: 'best-matches' | 'price-low' | 'price-high' | 'best-sellers'
  offset: number
  pageSize: number
}) {
  const orderBy = {
    'best-matches': 'created_at DESC',
    'price-low': 'base_price ASC',
    'price-high': 'base_price DESC',
    'best-sellers': 'featured DESC, created_at DESC',
  }[args.sort]
  const result = await query<{ count: number; ids: string[] }>(
    `WITH filtered AS (
       SELECT p.id, p.base_price, p.featured, p.created_at
         FROM public.products p
        WHERE p.status = $1
          AND ($2::text IS NULL OR p.product_lane::text = $2)
          AND ($3::uuid IS NULL OR p.main_category_id = $3)
          AND ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM public.product_subcategory_links x WHERE x.product_id = p.id AND x.subcategory_id = $4))
          AND ($5::uuid IS NULL OR EXISTS (SELECT 1 FROM public.product_option_links x WHERE x.product_id = p.id AND x.option_id = $5))
          AND ($6::uuid IS NULL OR EXISTS (SELECT 1 FROM public.product_stone_shapes x WHERE x.product_id = p.id AND x.shape_id = $6))
          AND ($7::uuid IS NULL OR EXISTS (SELECT 1 FROM public.product_metal_selections x WHERE x.product_id = p.id AND x.metal_id = $7))
          AND ($8::uuid IS NULL OR p.style_id = $8)
          AND ($9::uuid IS NULL OR p.certificate_ids @> jsonb_build_array($9::text))
     ), ranked AS (
       SELECT id, row_number() OVER (ORDER BY ${orderBy}) AS ordinal FROM filtered
     )
     SELECT (SELECT count(*)::int FROM filtered) AS count,
            COALESCE((SELECT jsonb_agg(id ORDER BY ordinal) FROM ranked WHERE ordinal > $10 AND ordinal <= $10 + $11), '[]'::jsonb) AS ids`,
    [
      'active', args.productLane ?? null, args.categoryId ?? null,
      args.subcategoryId ?? null, args.optionId ?? null, args.shapeId ?? null,
      args.metalId ?? null, args.styleId ?? null, args.certificateId ?? null,
      args.offset, args.pageSize,
    ],
    { operation: 'product.page.index' },
  )
  return result.rows[0] ?? { count: 0, ids: [] }
}

export async function loadProductFilterGroupsFromRds() {
  const [categories, subcategories, options, shapes, metals, styles, certificates] = await Promise.all([
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_categories t WHERE status = $1 ORDER BY display_order ASC', ['active'], 'product.filters.categories'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_subcategories t WHERE status = $1 ORDER BY display_order ASC', ['active'], 'product.filters.subcategories'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_options t WHERE status = $1 ORDER BY display_order ASC', ['active'], 'product.filters.options'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_stone_shapes t WHERE status = $1 ORDER BY display_order ASC', ['active'], 'product.filters.shapes'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_metals t WHERE status = $1 ORDER BY display_order ASC', ['active'], 'product.filters.metals'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_styles t WHERE status = $1 ORDER BY display_order ASC', ['active'], 'product.filters.styles'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_certificates t ORDER BY display_order ASC', [], 'product.filters.certificates'),
  ])
  type Category = { id: string; name: string; slug: string; category_lane: string | null }
  type Subcategory = { id: string; category_id: string; name: string; slug: string }
  type Option = { id: string; subcategory_id: string; name: string; slug: string }
  type Shape = { name: string; slug: string; svg_asset_url: string | null }
  type Metal = { name: string; slug: string; display_label: string | null; color_hex: string | null }
  type Style = { name: string; slug: string }
  type Certificate = { name: string }
  return [
    result(categories as Category[]), result(subcategories as Subcategory[]),
    result(options as Option[]), result(shapes as Shape[]), result(metals as Metal[]),
    result(styles as Style[]), result(certificates as Certificate[]),
  ] as const
}

export async function loadProductDiscoveryRowsFromRds() {
  type DiscoveryRow = {
    slug: string
    name: string
    description: string | null
    tag_line: string | null
    updated_at: string | null
  }
  const result = await query<DiscoveryRow>(
    'SELECT slug, name, description, tag_line, updated_at FROM public.products WHERE status = $1 ORDER BY created_at DESC',
    ['active'],
    { operation: 'product.discovery.rows' },
  )
  return result.rows
}

export type ProductSearchRow = {
  id: string
  slug: string
  name: string
  base_price: number | string | null
  image_1_path: string | null
  show_image_1: boolean | null
  main_category_id: string | null
  subcategory_id: string | null
  option_id: string | null
  style_id: string | null
  certificate_ids: string[] | null
}

export async function loadProductSearchReferencesFromRds() {
  const [categories, subcategories, options, metals, shapes, styles, certificates] = await Promise.all([
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_categories t WHERE status = $1', ['active'], 'product.search.categories'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_subcategories t WHERE status = $1', ['active'], 'product.search.subcategories'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_options t WHERE status = $1', ['active'], 'product.search.options'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_metals t WHERE status = $1', ['active'], 'product.search.metals'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_stone_shapes t WHERE status = $1', ['active'], 'product.search.shapes'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_styles t WHERE status = $1', ['active'], 'product.search.styles'),
    rows('SELECT to_jsonb(t) AS row FROM public.catalog_certificates t', [], 'product.search.certificates'),
  ])
  type Ref = { id: string; name: string; slug: string; code: string | null; display_label: string | null; purity_label: string | null; base_metal_name: string | null }
  return {
    categories: categories as Ref[], subcategories: subcategories as Ref[],
    options: options as Ref[], metals: metals as Ref[], shapes: shapes as Ref[],
    styles: styles as Ref[], certificates: certificates as Ref[],
  }
}

export async function loadSearchProductsFromRds(ids: string[] | null, limit: number) {
  const result = await query<ProductSearchRow>(
    `SELECT id, slug, name, base_price, image_1_path, show_image_1,
            main_category_id, subcategory_id, option_id, style_id, certificate_ids
       FROM public.products
      WHERE status = $1 AND ($2::uuid[] IS NULL OR id = ANY($2::uuid[]))
      ORDER BY featured DESC, created_at DESC LIMIT $3`,
    ['active', ids, limit],
    { operation: 'product.search.products' },
  )
  return result.rows
}

export async function loadProductSearchCandidatesFromRds(args: {
  tokens: string[]
  categoryIds: string[]
  subcategoryIds: string[]
  optionIds: string[]
  styleIds: string[]
  certificateIds: string[]
  metalIds: string[]
  shapeIds: string[]
}) {
  const noRows = Promise.resolve([] as JsonRow[])
  const [names, direct, certificates, metals, shapes, subcategoryLinks, optionLinks] = await Promise.all([
    rows(`SELECT jsonb_build_object('id', id, 'name', name, 'slug', slug) AS row
            FROM public.products p WHERE status = $1 AND EXISTS (
              SELECT 1 FROM unnest($2::text[]) AS token
               WHERE p.name ILIKE '%' || token || '%' OR p.slug ILIKE '%' || token || '%'
            ) LIMIT 80`, ['active', args.tokens], 'product.search.names'),
    args.categoryIds.length || args.subcategoryIds.length || args.optionIds.length || args.styleIds.length
      ? rows(`SELECT jsonb_build_object('id', id, 'main_category_id', main_category_id,
               'subcategory_id', subcategory_id, 'option_id', option_id, 'style_id', style_id) AS row
               FROM public.products WHERE status = $1 AND (
                 main_category_id = ANY($2::uuid[]) OR subcategory_id = ANY($3::uuid[])
                 OR option_id = ANY($4::uuid[]) OR style_id = ANY($5::uuid[])
               ) LIMIT 80`, ['active', args.categoryIds, args.subcategoryIds, args.optionIds, args.styleIds], 'product.search.direct')
      : noRows,
    args.certificateIds.length
      ? rows(`SELECT jsonb_build_object('id', id, 'certificate_ids', certificate_ids) AS row
               FROM public.products p WHERE status = $1 AND EXISTS (
                 SELECT 1 FROM jsonb_array_elements_text(p.certificate_ids) AS cert_id
                  WHERE cert_id = ANY($2::text[])
               ) LIMIT 80`, ['active', args.certificateIds], 'product.search.certificates')
      : noRows,
    args.metalIds.length
      ? rows('SELECT jsonb_build_object(\'product_id\', product_id, \'metal_id\', metal_id) AS row FROM public.product_metal_selections WHERE metal_id = ANY($1::uuid[]) LIMIT 80', [args.metalIds], 'product.search.metals')
      : noRows,
    args.shapeIds.length
      ? rows('SELECT jsonb_build_object(\'product_id\', product_id, \'shape_id\', shape_id) AS row FROM public.product_stone_shapes WHERE shape_id = ANY($1::uuid[]) LIMIT 80', [args.shapeIds], 'product.search.shapes')
      : noRows,
    args.subcategoryIds.length
      ? rows('SELECT jsonb_build_object(\'product_id\', product_id, \'subcategory_id\', subcategory_id) AS row FROM public.product_subcategory_links WHERE subcategory_id = ANY($1::uuid[]) LIMIT 80', [args.subcategoryIds], 'product.search.subcategory_links')
      : noRows,
    args.optionIds.length
      ? rows('SELECT jsonb_build_object(\'product_id\', product_id, \'option_id\', option_id) AS row FROM public.product_option_links WHERE option_id = ANY($1::uuid[]) LIMIT 80', [args.optionIds], 'product.search.option_links')
      : noRows,
  ])
  return [result(names), result(direct), result(certificates), result(metals), result(shapes), result(subcategoryLinks), result(optionLinks)] as const
}
