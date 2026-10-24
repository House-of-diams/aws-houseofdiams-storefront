import type { MetadataRoute } from 'next'
import { getPublishedBlogSummaries } from '@/lib/blog'
import { getPublishedEducationHubs, getPublishedEducationSummaries } from '@/lib/education'
import { educationHubPath, educationPostPath } from '@/lib/education-hubs'
import { getStorefrontProductDiscoveryRows } from '@/lib/catalog-products'
import { countListingProducts } from '@/lib/catalog-listing'
import { filterNonEmpty } from '@/lib/catalog-listing-rules'
import { getCanonicalUrl } from '@/lib/site-url'
import { buildCategoryPath, buildOptionPath, buildSubcategoryPath } from '@/lib/catalog-paths'
import { isPublicCatalogTaxonomy } from '@/lib/catalog-publication'
import { loadActiveCatalogTaxonomy } from '@/lib/repositories/catalog-repository'

// Pages an editor marked "hide from search" stay reachable but leave the sitemap.
function isIndexable(record: { seo_indexable?: boolean | null }) {
  return record.seo_indexable !== false
}

export const dynamic = 'force-dynamic'

const staticRoutes = [
  '/',
  '/shop',
  '/collection',
  '/bespoke',
  '/about',
  '/faq',
  '/shipping',
  '/returns',
  '/blog',
  '/education',
  '/privacy-policy',
  '/terms',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {

  const taxonomy = loadActiveCatalogTaxonomy()

  const [products, { categories, subcategories, options }, blogPosts, educationPosts, educationHubs] = await Promise.all([
    getStorefrontProductDiscoveryRows(),
    taxonomy,
    getPublishedBlogSummaries(),
    getPublishedEducationSummaries(),
    getPublishedEducationHubs(),
  ])

  const staticEntries = staticRoutes.map((route) => ({
    url: getCanonicalUrl(route).toString(),
  }))

  const categoryEntries = categories
    .filter(isPublicCatalogTaxonomy)
    .filter(isIndexable)
    .filter((category) => category.slug && category.slug !== 'hiphop')
    .filter((category) => !staticRoutes.includes(buildCategoryPath(category)))
    .map((category) => ({
      url: getCanonicalUrl(buildCategoryPath(category)).toString(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))

  // Pages that list no products stay out of the sitemap (their own robots tag says noindex too).
  const subcategoryCandidates = subcategories
    .filter(isPublicCatalogTaxonomy)
    .filter(isIndexable)
    .filter((subcategory) => subcategory.slug)
    .flatMap((subcategory) => {
      const category = categories.find((entry) => entry.id === subcategory.category_id)
      return category ? [{ category, subcategory, url: getCanonicalUrl(buildSubcategoryPath(category, subcategory)).toString() }] : []
    })
  const subcategoryEntries = (await filterNonEmpty(
    subcategoryCandidates,
    (entry) => countListingProducts({ categorySlug: entry.category.slug, subcategorySlug: entry.subcategory.slug, optionSlug: null, lane: entry.category.category_lane }),
  )).map((entry) => ({ url: entry.url, changeFrequency: 'daily' as const, priority: 0.7 }))

  const optionCandidates = options
    .filter(isPublicCatalogTaxonomy)
    .filter(isIndexable)
    .filter((option) => option.slug)
    .flatMap((option) => {
      const subcategory = subcategories.find((entry) => entry.id === option.subcategory_id)
      const category = subcategory ? categories.find((entry) => entry.id === subcategory.category_id) : undefined
      return subcategory && category ? [{ category, subcategory, option, url: getCanonicalUrl(buildOptionPath(category, subcategory, option)).toString() }] : []
    })
  const optionEntries = (await filterNonEmpty(
    optionCandidates,
    (entry) => countListingProducts({ categorySlug: entry.category.slug, subcategorySlug: entry.subcategory.slug, optionSlug: entry.option.slug, lane: entry.category.category_lane }),
  )).map((entry) => ({ url: entry.url, changeFrequency: 'daily' as const, priority: 0.6 }))

  const productEntries = products
    .filter((product) => product.slug)
    .map((product) => ({
      url: getCanonicalUrl(`/shop/${product.slug}`).toString(),
      lastModified: product.updated_at ? new Date(product.updated_at) : undefined,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    }))

  const blogEntries = blogPosts
    .filter((post) => post.slug && post.seoIndexable !== false)
    .map((post) => ({
      url: getCanonicalUrl(`/blog/${post.slug}`).toString(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  const educationEntries = educationPosts
    .filter((post) => post.slug && post.seoIndexable !== false)
    .filter((post) => post.slug !== 'education-copy')
    .map((post) => ({
      url: getCanonicalUrl(educationPostPath(post, educationHubs)).toString(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  const educationHubEntries = educationHubs
    .filter((hub) => hub.seoIndexable)
    .map((hub) => ({
      url: getCanonicalUrl(educationHubPath(hub)).toString(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

  return [
    ...staticEntries,
    ...categoryEntries,
    ...subcategoryEntries,
    ...optionEntries,
    ...productEntries,
    ...blogEntries,
    ...educationHubEntries,
    ...educationEntries,
  ]
}
