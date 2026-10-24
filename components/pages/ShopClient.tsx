'use client';

import { useCallback, useEffect, useState } from 'react';
import ShopHero from '@/components/shop/ShopHero';
import ProductGrid from '@/components/shop/ProductGrid';
import CategoryFaqSection, { type CategoryFaqItem } from '@/components/shop/CategoryFaqSection';
import MoreToExplore, { type MoreToExploreCategory } from '@/components/shop/MoreToExplore';
import { CategorySeoBody, CategorySeoIntro } from '@/components/shop/CategorySeoCopy';
import EnquireModal from '@/components/home/EnquireModal';
import type { StorefrontProductCard } from '@/lib/catalog-products';

const clientFilterKeys = ['category', 'subcategory', 'option', 'shape', 'style', 'metal', 'certificate'] as const

function filtersFromHref(href: string, products: StorefrontProductCard[]) {
  const target = new URL(href, window.location.origin)
  const filters: Record<string, string[]> = {}
  const pathSegments = target.pathname.split('/').filter(Boolean)

  // Category browse links use clean nested paths. Convert those segments into
  // the same client-side filters as their legacy query-string equivalents.
  if (pathSegments[0] && pathSegments[0] !== 'shop') {
    if (pathSegments[1]) filters.subcategory = [pathSegments[1]]
    if (pathSegments[2]) filters.option = [pathSegments[2]]
  }

  for (const key of clientFilterKeys) {
    const value = target.searchParams.get(key)
    if (!value) continue

    if (key === 'certificate') {
      const certificateName = products
        .flatMap((product) => product.certificateNames ?? [])
        .find((name) => name.toLowerCase().trim().replace(/\s+/g, '-') === value)
      filters[key] = [certificateName ?? value]
      continue
    }

    filters[key] = [value]
  }

  const parsedPage = Number.parseInt(target.searchParams.get('page') ?? '1', 10)
  return { target, filters, page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1 }
}

export default function ShopClient({
  products,
  sourceProducts,
  heroTitle,
  heroHeading,
  heroSubtitle,
  heroDesktopImageUrl,
  heroMobileImageUrl,
  heroImageAlt,
  heroCtaLabel,
  heroCtaHref,
  heroBannerEnabled,
  initialFilters,
  initialPage = 1,
  filterGroups,
  masterShapeOptions,
  totalCount,
  serverPaginated = false,
  categoryLoadMore = false,
  headerBrowseSections,
  categoryName,
  categoryFaqItems = [],
  moreToExploreCategories = [],
  seoIntroHtml = null,
  seoBodyHtml = null,
  seoGuide = null,
}: {
  products: StorefrontProductCard[]
  sourceProducts?: StorefrontProductCard[]
  heroTitle?: string
  heroHeading?: string
  heroSubtitle?: string
  heroDesktopImageUrl?: string
  heroMobileImageUrl?: string
  heroImageAlt?: string
  heroCtaLabel?: string
  heroCtaHref?: string
  heroBannerEnabled?: boolean
  initialFilters?: Record<string, string[]>
  initialPage?: number
  filterGroups?: { id: string; title: string; options: { value: string; label: string }[] }[]
  masterShapeOptions?: { value: string; label: string; iconUrl?: string | null; displayOrder: number }[]
  totalCount?: number
  serverPaginated?: boolean
  categoryLoadMore?: boolean
  categoryName?: string
  categoryFaqItems?: CategoryFaqItem[]
  moreToExploreCategories?: MoreToExploreCategory[]
  seoIntroHtml?: string | null
  seoBodyHtml?: string | null
  seoGuide?: { href: string; title: string } | null
  headerBrowseSections?: {
    id: string
    title: string
    iconUrl?: string | null
    href?: string | null
    options: { label: string; href: string; type?: 'default' | 'swatch' | 'icon'; iconUrl?: string | null; colorHex?: string | null }[]
    emphasis?: 'section' | 'group'
  }[]
}) {
  const [isEnquireOpen, setIsEnquireOpen] = useState(false);
  const [enquirePiece, setEnquirePiece] = useState('');
  const clientProducts = sourceProducts ?? products;
  const [activeFilters, setActiveFilters] = useState(initialFilters ?? {});
  const [activePage, setActivePage] = useState(initialPage);
  const resolvedFilters = serverPaginated ? (initialFilters ?? {}) : activeFilters
  const resolvedPage = serverPaginated ? initialPage : activePage

  const applyClientBrowseHref = useCallback((href: string) => {
    if (serverPaginated) return false
    const { target, filters, page } = filtersFromHref(href, clientProducts)
    const currentCategory = window.location.pathname.split('/').filter(Boolean)[0]
    const targetCategory = target.pathname.split('/').filter(Boolean)[0]
    if (target.origin !== window.location.origin || targetCategory !== currentCategory) return false

    setActiveFilters(filters)
    setActivePage(page)
    window.history.pushState(null, '', `${target.pathname}${target.search}${target.hash}`)
    return true
  }, [clientProducts, serverPaginated])

  useEffect(() => {
    const handlePopState = () => {
      const { filters, page } = filtersFromHref(window.location.href, clientProducts)
      setActiveFilters(filters)
      setActivePage(page)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [clientProducts])

  const handleEnquire = (name: string = '') => {
    setEnquirePiece(name);
    setIsEnquireOpen(true);
  };

  return (
    <div className="min-h-screen bg-(--bg) text-(--ink) mt-0 lg:-mt-[146px]">
      <ShopHero
        title={heroTitle}
        heading={heroHeading}
        subtitle={heroSubtitle}
        desktopImageUrl={heroDesktopImageUrl}
        mobileImageUrl={heroMobileImageUrl}
        imageAlt={heroImageAlt}
        ctaLabel={heroCtaLabel}
        ctaHref={heroCtaHref}
        bannerEnabled={heroBannerEnabled}
        browseSections={headerBrowseSections}
        activeFilters={resolvedFilters}
        onBrowseNavigate={applyClientBrowseHref}
        wideGutter={Boolean(categoryName)}
      />
      {seoIntroHtml ? <CategorySeoIntro html={seoIntroHtml} wideGutter={Boolean(categoryName)} /> : null}
      <ProductGrid
        key={`${JSON.stringify(resolvedFilters)}:${resolvedPage}`}
        products={serverPaginated ? products : clientProducts}
        sourceProducts={clientProducts}
        initialFilters={resolvedFilters}
        initialPage={resolvedPage}
        filterGroups={filterGroups}
        masterShapeOptions={masterShapeOptions}
        totalCount={totalCount}
        serverPaginated={serverPaginated}
        categoryLoadMore={categoryLoadMore}
        onEnquire={handleEnquire}
        wideGutter={Boolean(categoryName)}
      />
      <CategorySeoBody html={seoBodyHtml} guide={seoGuide} />
      {categoryName && categoryFaqItems.length ? <CategoryFaqSection categoryName={categoryName} items={categoryFaqItems} /> : null}
      <MoreToExplore categories={moreToExploreCategories} />
      <EnquireModal open={isEnquireOpen} piece={enquirePiece} onClose={() => setIsEnquireOpen(false)} />
    </div>
  );
}
