import type { Metadata } from 'next';
import { createFixedPageMetadata } from '@/lib/page-seo'

export const dynamic = 'force-dynamic'
import ShopClient from '@/components/pages/ShopClient';
import { getStorefrontFilterGroups, getStorefrontProductCardPage, type StorefrontProductSort } from '@/lib/catalog-products';
import JsonLd from '@/components/seo/JsonLd';
import { createBreadcrumbSchema } from '@/lib/structured-data';
import { getCatalogCanonicalPath, hasCatalogFilterQuery, parseCatalogPage } from '@/lib/catalog-metadata';
import { notFound } from 'next/navigation';

function hasShopFilterQuery(params: Record<string, string | string[] | undefined>) {
  return hasCatalogFilterQuery(params) || (typeof params.category === 'string' && Boolean(params.category))
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const params = await searchParams
  const isFiltered = hasShopFilterQuery(params)
  const metadata = await createFixedPageMetadata('shop', {
    title: 'Shop',
    description: 'Browse our collection of fine jewelry and hip hop jewelry with certified lab-grown diamonds.',
    path: isFiltered ? '/shop' : getCatalogCanonicalPath('/shop', params),
  })

  if (!isFiltered) return metadata

  return {
    ...metadata,
    robots: {
      index: false,
      follow: true,
    },
  }
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const page = parseCatalogPage(params.page)
  if (page === null) notFound()
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
    getStorefrontProductCardPage({ productLane: 'standard', filters, sort, page }),
    getStorefrontFilterGroups('standard'),
  ])
  const totalPages = Math.ceil(productPage.totalCount / productPage.pageSize)
  if (page > 1 && (totalPages === 0 || page > totalPages)) notFound()

  return (
    <>
      <JsonLd data={createBreadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }])} />
      <ShopClient
        products={productPage.products}
        filterGroups={filterGroups}
        totalCount={productPage.totalCount}
        serverPaginated
        heroTitle="Our Collection"
        heroSubtitle="Browse our curated selection of fine jewelry, engagement rings, and wedding bands."
        initialFilters={{
          ...(typeof params.category === 'string' ? { category: [params.category] } : {}),
          ...(typeof params.shape === 'string' ? { shape: [params.shape] } : {}),
          ...(typeof params.style === 'string' ? { style: [params.style] } : {}),
          ...(typeof params.metal === 'string' ? { metal: [params.metal] } : {}),
          ...(typeof params.certificate === 'string' ? { certificate: [params.certificate] } : {}),
        }}
        initialPage={productPage.page}
      />
    </>
  );
}
