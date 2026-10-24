import 'server-only'

import { query } from '@/lib/db/query'

export type CatalogCategory = { id: string; name: string; slug: string }
export type CatalogSubcategory = { id: string; category_id: string; name: string; slug: string }
export type CatalogOption = { id: string; subcategory_id: string; name: string; slug: string }

/** SEO fields an editor can set per category, subcategory or option (all optional). */
export type CatalogSeoFields = {
  seo_title: string | null
  seo_description: string | null
  seo_h1: string | null
  seo_intro_html: string | null
  seo_body_html: string | null
  seo_guide_path: string | null
  seo_indexable: boolean
}

export type CatalogCategoryPage = CatalogCategory & {
  status: string
  category_lane: string | null
  banner_desktop_image_path: string | null
  banner_mobile_image_path: string | null
  banner_desktop_image_alt: string | null
  banner_mobile_image_alt: string | null
  banner_title: string | null
  banner_subtitle: string | null
  banner_cta_label: string | null
  banner_cta_link: string | null
  banner_enabled: boolean | null
  display_order: number
} & CatalogSeoFields

export async function findActiveCatalogCategoryPageBySlug(slug: string): Promise<CatalogCategoryPage | null> {
  const result = await query<CatalogCategoryPage>(
    'SELECT id, name, slug, status, category_lane, banner_desktop_image_path, banner_mobile_image_path, banner_desktop_image_alt, banner_mobile_image_alt, banner_title, banner_subtitle, banner_cta_label, banner_cta_link, banner_enabled, display_order, seo_title, seo_description, seo_h1, seo_intro_html, seo_body_html, seo_guide_path, seo_indexable FROM public.catalog_categories WHERE slug = $1 AND status = $2 LIMIT 1',
    [slug, 'active'],
    { operation: 'catalog.category.page_by_slug' },
  )
  return result.rows[0] ?? null
}

export async function loadActiveCatalogTaxonomy() {
  const [categories, subcategories, options] = await Promise.all([
    query<CatalogCategoryPage>('SELECT * FROM public.catalog_categories WHERE status = $1', ['active'], { operation: 'catalog.categories.active' }),
    query<CatalogSubcategory & CatalogSeoFields & { status: string }>('SELECT * FROM public.catalog_subcategories WHERE status = $1', ['active'], { operation: 'catalog.subcategories.active' }),
    query<CatalogOption & CatalogSeoFields & { status: string }>('SELECT * FROM public.catalog_options WHERE status = $1', ['active'], { operation: 'catalog.options.active' }),
  ])
  return { categories: categories.rows, subcategories: subcategories.rows, options: options.rows }
}

export async function loadFooterCategoriesFromRds(): Promise<CatalogCategory[]> {
  const result = await query<CatalogCategory>(
    'SELECT id, name, slug FROM public.catalog_categories WHERE status = $1 ORDER BY display_order ASC',
    ['active'], { operation: 'catalog.footer_categories' },
  )
  return result.rows
}

export async function loadBespokeExploreCategoriesFromRds() {
  const result = await query<CatalogCategory & {
    banner_desktop_image_path: string | null; banner_mobile_image_path: string | null;
    banner_desktop_image_alt: string | null; banner_mobile_image_alt: string | null;
  }>(
    `SELECT id, name, slug, banner_desktop_image_path, banner_mobile_image_path,
            banner_desktop_image_alt, banner_mobile_image_alt
       FROM public.catalog_categories WHERE status = $1 ORDER BY display_order ASC LIMIT 8`,
    ['active'], { operation: 'catalog.bespoke_explore' },
  )
  return result.rows
}

export async function findActiveCatalogCategoryBySlug(slug: string): Promise<(CatalogCategory & CatalogSeoFields) | null> {
  const result = await query<CatalogCategory & CatalogSeoFields>(
    'SELECT id, name, slug, seo_title, seo_description, seo_h1, seo_intro_html, seo_body_html, seo_guide_path, seo_indexable FROM public.catalog_categories WHERE slug = $1 AND status = $2 LIMIT 1',
    [slug, 'active'],
    { operation: 'catalog.category.by_slug' },
  )
  return result.rows[0] ?? null
}

export async function findActiveCatalogSubcategoryBySlug(
  categoryId: string,
  slug: string,
): Promise<(CatalogSubcategory & CatalogSeoFields) | null> {
  const result = await query<CatalogSubcategory & CatalogSeoFields>(
    'SELECT id, category_id, name, slug, seo_title, seo_description, seo_h1, seo_intro_html, seo_body_html, seo_guide_path, seo_indexable FROM public.catalog_subcategories WHERE category_id = $1 AND slug = $2 AND status = $3 LIMIT 1',
    [categoryId, slug, 'active'],
    { operation: 'catalog.subcategory.by_slug' },
  )
  return result.rows[0] ?? null
}

export async function findActiveCatalogOptionBySlug(
  subcategoryId: string,
  slug: string,
): Promise<(CatalogOption & CatalogSeoFields) | null> {
  const result = await query<CatalogOption & CatalogSeoFields>(
    'SELECT id, subcategory_id, name, slug, seo_title, seo_description, seo_h1, seo_intro_html, seo_body_html, seo_guide_path, seo_indexable FROM public.catalog_options WHERE subcategory_id = $1 AND slug = $2 AND status = $3 LIMIT 1',
    [subcategoryId, slug, 'active'],
    { operation: 'catalog.option.by_slug' },
  )
  return result.rows[0] ?? null
}
