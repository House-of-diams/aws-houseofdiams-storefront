import type { Metadata } from 'next';
import { createFixedPageMetadata } from '@/lib/page-seo'

export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation';
import ShopClient from '@/components/pages/ShopClient';
import { getStorefrontFilterGroups, getStorefrontProductCardPage, type StorefrontProductSort } from '@/lib/catalog-products';
import { getHomePageData } from '@/lib/home-data';

export function generateMetadata(): Promise<Metadata> {
  return createFixedPageMetadata('collection', {
  title: 'Collection',
  description: 'Explore House of Diams collection pieces in a dedicated browse-only experience.',
  path: '/collection',
})
}

export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const { collectionPageConfig } = await getHomePageData();
  if (!collectionPageConfig.pageEnabled) notFound();

  const requestedSort = typeof params.sort === 'string' ? params.sort : 'best-matches'
  const sort: StorefrontProductSort = ['best-matches', 'price-low', 'price-high', 'best-sellers'].includes(requestedSort)
    ? requestedSort as StorefrontProductSort
    : 'best-matches'
  const filters = {
    categorySlug: typeof params.category === 'string' ? params.category : null,
    subcategorySlug: typeof params.subcategory === 'string' ? params.subcategory : null,
    optionSlug: typeof params.option === 'string' ? params.option : null,
    shapeSlug: typeof params.shape === 'string' ? params.shape : null,
    styleSlug: typeof params.style === 'string' ? params.style : null,
    metalSlug: typeof params.metal === 'string' ? params.metal : null,
    certificate: typeof params.certificate === 'string' ? params.certificate : null,
  }
  const [productPage, filterGroups] = await Promise.all([
    getStorefrontProductCardPage({
      productLane: 'collection',
      filters,
      sort,
      page: typeof params.page === 'string' ? Math.max(1, Number.parseInt(params.page, 10) || 1) : 1,
    }),
    getStorefrontFilterGroups('collection'),
  ])

  return (
    <ShopClient
      products={productPage.products}
      filterGroups={filterGroups}
      totalCount={productPage.totalCount}
      serverPaginated
      initialFilters={Object.fromEntries(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])).map(([key, value]) => [key.replace('Slug', ''), [value]]))}
      initialPage={productPage.page}
      heroTitle={collectionPageConfig.showcaseHeading || 'Collection'}
      heroSubtitle={collectionPageConfig.showcaseSubtitle || 'Browse House of Diams collection pieces in a dedicated enquiry-first showcase.'}
    />
  );
}
