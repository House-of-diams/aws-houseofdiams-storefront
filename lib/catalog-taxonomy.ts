import { cache } from 'react'
import {
  findActiveCatalogCategoryBySlug,
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

export const resolveCatalogTaxonomy = cache(async (args: {
  categorySlug: string
  subcategorySlug: string
  optionSlug?: string
}): Promise<ResolvedCatalogTaxonomy | null> => {
  // Preserve active-category boundaries for every RDS taxonomy lookup.
  const category = await findActiveCatalogCategoryBySlug(args.categorySlug)
  if (!category) return null
  const subcategory = await findActiveCatalogSubcategoryBySlug(category.id, args.subcategorySlug)
  if (!subcategory) return null
  if (!args.optionSlug) return { category, subcategory, option: null }
  const option = await findActiveCatalogOptionBySlug(subcategory.id, args.optionSlug)
  return option ? { category, subcategory, option } : null

})
