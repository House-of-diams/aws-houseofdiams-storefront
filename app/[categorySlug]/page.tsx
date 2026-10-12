import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

import { createPageMetadata } from '@/lib/seo'
import { mediaUrl } from '@/lib/media-url'
import { buildCategoryPath } from '@/lib/catalog-paths'
import { getCatalogCategoryPageBySlug as getCategoryBySlug } from '@/lib/catalog-taxonomy'
import { getCatalogCanonicalPath, hasCatalogFilterQuery } from '@/lib/catalog-metadata'
import { CategoryCollectionPageContent } from './CategoryCollectionPageContent'

function toPublicUrl(path: string | null | undefined) {
  return path ? mediaUrl(path) : null
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ categorySlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const { categorySlug } = await params
  const query = await searchParams
  const category = await getCategoryBySlug(categorySlug)

  if (!category) {
    return {
      title: 'Collection',
      description: 'Browse our collection.',
    }
  }

  const metadata = createPageMetadata({
    title: category.name,
    description: category.banner_subtitle || `Browse ${category.name} from the live catalog.`,
    path: getCatalogCanonicalPath(buildCategoryPath(category), query),
    image: toPublicUrl(category.banner_desktop_image_path),
  })

  if (!hasCatalogFilterQuery(query)) return metadata

  return {
    ...metadata,
    robots: {
      index: false,
      follow: true,
    },
  }
}

export default async function CategoryCollectionPage(props: {
  params: Promise<{ categorySlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return <CategoryCollectionPageContent {...props} />
}
