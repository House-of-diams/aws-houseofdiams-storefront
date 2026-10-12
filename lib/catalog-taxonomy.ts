import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import {
  findActiveCatalogCategoryBySlug,
  findActiveCatalogCategoryPageBySlug,
  findActiveCatalogOptionBySlug,
  findActiveCatalogSubcategoryBySlug,
} from '@/lib/repositories/catalog-repository'

export type ResolvedCatalogTaxonomy = {
  category: {
    id: string
    name: string
    slug: string
  }
  subcategory: {
    id: string
    category_id: string
    name: string
    slug: string
  }
  option: {
    id: string
    subcategory_id: string
    name: string
    slug: string
  } | null
}

// Keyed by slugs (not object identity) so page metadata and page body share
// one result, and visitors share it across requests.
const getCachedCatalogTaxonomy = unstable_cache(
  async (categorySlug: string, subcategorySlug: string, optionSlug: string | null): Promise<ResolvedCatalogTaxonomy | null> => {
    // Preserve active-category boundaries for every RDS taxonomy lookup.
    const category = await findActiveCatalogCategoryBySlug(categorySlug)
    if (!category) return null
    const subcategory = await findActiveCatalogSubcategoryBySlug(category.id, subcategorySlug)
    if (!subcategory) return null
    if (!optionSlug) return { category, subcategory, option: null }
    const option = await findActiveCatalogOptionBySlug(subcategory.id, optionSlug)
    return option ? { category, subcategory, option } : null
  },
  ['catalog-taxonomy-v1'],
  { revalidate: 300, tags: ['storefront-products'] }
)

export const resolveCatalogTaxonomy = cache((args: {
  categorySlug: string
  subcategorySlug: string
  optionSlug?: string
}): Promise<ResolvedCatalogTaxonomy | null> =>
  getCachedCatalogTaxonomy(args.categorySlug, args.subcategorySlug, args.optionSlug ?? null)
)

const getCachedCatalogCategoryPage = unstable_cache(
  (slug: string) => findActiveCatalogCategoryPageBySlug(slug),
  ['catalog-category-page-v1'],
  { revalidate: 300, tags: ['storefront-products'] }
)

/** Category landing data (banner, copy) shared by page metadata and body. */
export const getCatalogCategoryPageBySlug = cache((slug: string) => getCachedCatalogCategoryPage(slug))
