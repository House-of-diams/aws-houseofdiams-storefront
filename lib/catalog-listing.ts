import 'server-only'

import { getStorefrontProductCardPage } from '@/lib/catalog-products'

type ProductLane = 'standard' | 'hiphop' | 'collection'

/**
 * How many products a category, subcategory or option page lists. The arguments are the same ones the page itself
 * uses, so this reads the page's own cached result. Returns null when the count cannot be read (callers treat that
 * as "unknown", never as "empty").
 */
export async function countListingProducts(args: {
  categorySlug: string
  subcategorySlug: string | null
  optionSlug: string | null
  lane?: string | null
}): Promise<number | null> {
  try {
    const page = await getStorefrontProductCardPage({
      productLane: (args.lane ?? 'standard') as ProductLane,
      filters: {
        categorySlug: args.categorySlug,
        subcategorySlug: args.subcategorySlug,
        optionSlug: args.optionSlug,
        shapeSlug: null,
        styleSlug: null,
        metalSlug: null,
        certificate: null,
      },
      sort: 'best-matches',
      page: 1,
      pageSize: 24,
    })
    return Number.isFinite(page.totalCount) ? page.totalCount : null
  } catch {
    return null
  }
}
