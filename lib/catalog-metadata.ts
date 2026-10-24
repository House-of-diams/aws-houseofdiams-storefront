import type { Metadata } from 'next'
import { createPageMetadata } from '@/lib/seo'
import { buildOptionPath, buildSubcategoryPath } from '@/lib/catalog-paths'
import { getCatalogCategoryPageBySlug, type ResolvedCatalogTaxonomy } from '@/lib/catalog-taxonomy'
import { countListingProducts } from '@/lib/catalog-listing'
import { shouldIndexListing } from '@/lib/catalog-listing-rules'

const filterQueryKeys = ['subcategory', 'option', 'shape', 'style', 'metal', 'certificate', 'sort'] as const
export const MAX_CATALOG_PAGE = 100000

export function hasCatalogFilterQuery(params: Record<string, string | string[] | undefined>) {
  return filterQueryKeys.some((key) => typeof params[key] === 'string' && Boolean(params[key]))
}

export function parseCatalogPage(value: string | string[] | undefined) {
  if (value === undefined) return 1
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null

  const page = Number(value)
  return Number.isSafeInteger(page) && page <= MAX_CATALOG_PAGE ? page : null
}

export function getCatalogCanonicalPath(
  path: string,
  query: Record<string, string | string[] | undefined>
) {
  if (hasCatalogFilterQuery(query)) return path

  const page = parseCatalogPage(query.page)
  return page && page > 1 ? `${path}?page=${page}` : path
}

export async function generateCatalogMetadata(
  taxonomy: ResolvedCatalogTaxonomy,
  query: Record<string, string | string[] | undefined>
): Promise<Metadata> {
  const path = taxonomy.option
    ? buildOptionPath(taxonomy.category, taxonomy.subcategory, taxonomy.option)
    : buildSubcategoryPath(taxonomy.category, taxonomy.subcategory)
  const record = taxonomy.option ?? taxonomy.subcategory
  const title = record.name
  const metadata = createPageMetadata({
    title: record.seo_title?.trim() || `${title} | ${taxonomy.category.name}`,
    description: record.seo_description?.trim() || `Browse ${title} in ${taxonomy.category.name}.`,
    path: getCatalogCanonicalPath(path, query),
  })

  // Filtered views never index; an editor can also hide the page itself from search.
  if (hasCatalogFilterQuery(query) || record.seo_indexable === false) return { ...metadata, robots: { index: false, follow: true } }

  // A listing with no products is a thin page ("No pieces match"): keep it out of search until it has some.
  const category = await getCatalogCategoryPageBySlug(taxonomy.category.slug).catch(() => null)
  const totalCount = await countListingProducts({
    categorySlug: taxonomy.category.slug,
    subcategorySlug: taxonomy.subcategory.slug,
    optionSlug: taxonomy.option?.slug ?? null,
    lane: category?.category_lane,
  })
  return shouldIndexListing({ totalCount }) ? metadata : { ...metadata, robots: { index: false, follow: true } }
}
