import { loadCategoryFaqFromRds } from '@/lib/repositories/legacy-cms-repository'
import { unstable_cache } from 'next/cache'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import ShopClient from '@/components/pages/ShopClient'
import { buildNavbarRenderItems } from '@/lib/navbar'
import { getStorefrontFilterGroups, getStorefrontProductCardPage, type StorefrontProductSort } from '@/lib/catalog-products'
import JsonLd from '@/components/seo/JsonLd'
import { createBreadcrumbSchema, createFaqSchema } from '@/lib/structured-data'
import { buildCategoryPath, buildOptionPath, buildSubcategoryPath } from '@/lib/catalog-paths'
import type { ResolvedCatalogTaxonomy } from '@/lib/catalog-taxonomy'
import { parseCatalogPage } from '@/lib/catalog-metadata'
import { findActiveCatalogCategoryPageBySlug } from '@/lib/repositories/catalog-repository'
import { loadNavbarRowsFromRds } from '@/lib/repositories/navbar-repository'
import { mediaUrl } from '@/lib/media-url'

function slugifyValue(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function toPublicUrl(path: string | null | undefined) {
  return path ? mediaUrl(path) : null
}

const getCategoryBySlug = cache(async (slug: string) => {
  return findActiveCatalogCategoryPageBySlug(slug)

})

const getCategoryReferenceData = unstable_cache(
  async () => {
    const rows = await loadNavbarRowsFromRds()
    return [
      { data: rows.items, error: null as { code?: string; message: string } | null },
      { data: rows.sections, error: null as { code?: string; message: string } | null },
      { data: rows.sectionLinks, error: null as { code?: string; message: string } | null },
      { data: rows.sectionSourceItems, error: null as { code?: string; message: string } | null },
      { data: rows.featuredCards, error: null as { code?: string; message: string } | null },
      { data: rows.categories, error: null as { code?: string; message: string } | null },
      { data: rows.subcategories, error: null as { code?: string; message: string } | null },
      { data: rows.options, error: null as { code?: string; message: string } | null },
      { data: rows.certificates, error: null as { code?: string; message: string } | null },
      { data: rows.metals, error: null as { code?: string; message: string } | null },
      { data: rows.stoneShapes, error: null as { code?: string; message: string } | null },
      { data: rows.styles, error: null as { code?: string; message: string } | null },
    ] as const

  },
  ['category-page-reference-data'],
  { revalidate: 300 }
)

function uniqueSectionOptions(
  options: { label: string; href: string; type?: 'default' | 'swatch' | 'icon'; iconUrl?: string | null; colorHex?: string | null }[]
) {
  const seen = new Set<string>()
  return options.filter((option) => {
    const key = `${option.label}::${option.href}::${option.type ?? 'default'}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function uniqueBrowseSections<T extends { id: string; title: string; href?: string | null }>(sections: T[]) {
  const seen = new Set<string>()
  return sections.filter((section) => {
    const key = `${section.title}::${section.href ?? ''}::${section.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function resolveMasterFilterHref(args: {
  href: string
  currentCategorySlug: string
}) {
  const { href, currentCategorySlug } = args

  if (!href.startsWith('/shop?')) return href

  const search = href.split('?')[1] ?? ''
  const params = new URLSearchParams(search)
  return `/${currentCategorySlug}?${params.toString()}`
}

function deriveSectionFilterHref(
  options: { href: string }[],
  currentCategorySlug: string
) {
  for (const option of options) {
    try {
      const target = new URL(option.href, 'https://houseofdiams.local')
      const subcategory = target.searchParams.get('subcategory')
      if (subcategory) return `/${currentCategorySlug}?subcategory=${subcategory}`

      const segments = target.pathname.split('/').filter(Boolean)
      if (segments[0] === currentCategorySlug && segments[1]) {
        return `/${currentCategorySlug}/${segments[1]}`
      }
    } catch { }
  }

  return null
}

export async function CategoryCollectionPageContent({
  params,
  searchParams,
  taxonomy = null,
}: {
  params: Promise<{ categorySlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
  taxonomy?: ResolvedCatalogTaxonomy | null
}) {
  const { categorySlug } = await params
  const category = await getCategoryBySlug(categorySlug)

  if (!category) {
    notFound()
  }

  const query = await searchParams
  const requestedPage = parseCatalogPage(query.page)
  if (!requestedPage) notFound()
  const resolvedProductLane = (category.category_lane ?? 'standard') as 'standard' | 'hiphop' | 'collection'
  const requestedSort = typeof query.sort === 'string' ? query.sort : 'best-matches'
  const sort: StorefrontProductSort = ['best-matches', 'price-low', 'price-high', 'best-sellers'].includes(requestedSort)
    ? requestedSort as StorefrontProductSort
    : 'best-matches'
  const productFilters = {
    categorySlug,
    subcategorySlug: taxonomy?.subcategory.slug ?? (typeof query.subcategory === 'string' ? query.subcategory : null),
    optionSlug: taxonomy?.option?.slug ?? (typeof query.option === 'string' ? query.option : null),
    shapeSlug: typeof query.shape === 'string' ? query.shape : null,
    styleSlug: typeof query.style === 'string' ? query.style : null,
    metalSlug: typeof query.metal === 'string' ? query.metal : null,
    certificate: typeof query.certificate === 'string' ? query.certificate : null,
  }
  const [productPage, filterGroups, referenceData, categoryFaqResult] = await Promise.all([
    getStorefrontProductCardPage({
      productLane: resolvedProductLane,
      filters: productFilters,
      sort,
      page: requestedPage,
      pageSize: 24,
    }),
    getStorefrontFilterGroups(resolvedProductLane, category.id),
    getCategoryReferenceData(),
    loadCategoryFaqFromRds(category.id).then((data) => ({ data, error: null as { code?: string; message: string } | null })),
  ])
  const totalPages = Math.ceil(productPage.totalCount / productPage.pageSize)
  if (requestedPage > 1 && (totalPages === 0 || requestedPage > totalPages)) {
    notFound()
  }
  const categoryFaqItems = categoryFaqResult.error ? [] : categoryFaqResult.data ?? []
  const [
    navbarItemsResult,
    navbarSectionsResult,
    navbarLinksResult,
    navbarSourceItemsResult,
    navbarFeaturedResult,
    categoriesResult,
    categorySubcategoriesResult,
    categoryOptionsResult,
    certificatesResult,
    metalsResult,
    stoneShapesResult,
    stylesResult,
  ] = referenceData

  const headerBrowseSections = (() => {
    const navbarItems = navbarItemsResult.data ?? []
    const navbarSections = navbarSectionsResult.data ?? []
    const navbarLinks = navbarLinksResult.data ?? []
    const navbarSourceItems = navbarSourceItemsResult.data ?? []
    const navbarFeatured = navbarFeaturedResult.data ?? []
    const subcategories = categorySubcategoriesResult.data ?? []
    const options = categoryOptionsResult.data ?? []
    const certificates = certificatesResult.error ? [] : (certificatesResult.data ?? []).map((entry, index) => ({ id: `${index}-${entry.name}`, name: entry.name, status: 'active' as const }))
    const metals = metalsResult.error ? [] : (metalsResult.data ?? []).map((entry, index) => ({ ...entry, display_order: index, status: 'active' as const }))
    const stoneShapes = stoneShapesResult.error ? [] : (stoneShapesResult.data ?? []).map((entry, index) => ({ ...entry, display_order: index, status: 'active' as const }))
    const styles = stylesResult.error ? [] : stylesResult.data ?? []

    const renderItems = buildNavbarRenderItems({
      items: navbarItems,
      sections: navbarSections,
      sectionLinks: navbarLinks,
      sectionSourceItems: navbarSourceItems,
      featuredCards: navbarFeatured,
      categories: categoriesResult.error ? [{ ...category, status: 'active' as const, display_order: 0 }] : categoriesResult.data ?? [{ ...category, display_order: 0 }],
      subcategories,
      options,
      metals,
      stoneShapes,
      certificates,
      styles,
    })

    const matchedItem = renderItems.find((entry) => entry.linkedCategoryId === category.id || entry.slug === category.slug)
    const filterSections = (matchedItem?.mega?.sections ?? []).filter((section) => section.showAsFilter)

    const contentSections = filterSections.map((section) => {
      const allOptions = uniqueSectionOptions([
        ...(section.metals ?? []).map((metal) => ({
          label: metal.label,
          href: resolveMasterFilterHref({
            href: metal.href,
            currentCategorySlug: categorySlug,
          }),
          type: 'swatch' as const,
          colorHex: metal.colorHex ?? null,
        })),
        ...((section.links ?? [])
          .filter((link) => !link.isCategoryLink)
          .map((link) => ({
            label: link.label,
            href: resolveMasterFilterHref({
              href: link.href,
              currentCategorySlug: categorySlug,
            }),
            type: link.type ?? 'default',
            iconUrl: link.iconUrl ?? null,
            colorHex: link.colorHex ?? null,
          }))),
      ])

      return {
        id: section.id,
        title: section.title,
        iconUrl: section.iconUrl,
        href: deriveSectionFilterHref(allOptions, categorySlug),
        options: allOptions,
      }
    })

    const navbarBrowseSections = uniqueBrowseSections(contentSections)

    if (navbarBrowseSections.length > 0) {
      return navbarBrowseSections
    }

    const fallbackSubcategories = subcategories
      .filter((entry) => entry.category_id === category.id)
      .sort((left, right) => left.display_order - right.display_order)

    const fallbackSections = fallbackSubcategories.map((subcategory) => {
      const subcategoryOptions = options
        .filter((entry) => entry.subcategory_id === subcategory.id)
        .sort((left, right) => left.display_order - right.display_order)

      return {
        id: `fallback-${subcategory.id}`,
        title: subcategory.name,
        iconUrl: toPublicUrl(subcategory.image_path ?? subcategory.icon_svg_path) ?? null,
        href: buildSubcategoryPath(category, subcategory),
        options: subcategoryOptions.map((option) => ({
          label: option.name,
          href: buildOptionPath(category, subcategory, option),
          type: (option.image_path ?? option.icon_svg_path) ? ('icon' as const) : ('default' as const),
          iconUrl: toPublicUrl(option.image_path ?? option.icon_svg_path) ?? null,
        })),
      }
    })

    return uniqueBrowseSections(fallbackSections.filter((section) => section.options.length > 0))
  })()

  const certificateFilterValue =
    typeof query.certificate === 'string'
      ? (certificatesResult.error ? [] : certificatesResult.data ?? []).find((entry) => slugifyValue(entry.name) === query.certificate)?.name ?? query.certificate
      : null

  const moreToExploreCategories = (categoriesResult.error ? [] : categoriesResult.data ?? [])
    .filter((entry) => entry.slug !== category.slug && (entry.banner_desktop_image_path || entry.banner_mobile_image_path))
    .map((entry) => ({
      name: entry.name,
      href: buildCategoryPath(entry),
      imageUrl: toPublicUrl(entry.banner_desktop_image_path ?? entry.banner_mobile_image_path),
      imageAlt: entry.banner_desktop_image_alt || entry.banner_mobile_image_alt || entry.name,
    }))

  return (
    <>
      <JsonLd
        data={createBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: category.name, path: buildCategoryPath(category) },
          ...(taxonomy
            ? [{ name: taxonomy.subcategory.name, path: buildSubcategoryPath(taxonomy.category, taxonomy.subcategory) }]
            : []),
          ...(taxonomy?.option
            ? [{ name: taxonomy.option.name, path: buildOptionPath(taxonomy.category, taxonomy.subcategory, taxonomy.option) }]
            : []),
        ])}
      />
      {categoryFaqItems.length ? <JsonLd data={createFaqSchema(categoryFaqItems.map(({ question, answer }) => ({ question, answer })))} /> : null}
      <ShopClient
        products={productPage.products}
        filterGroups={filterGroups}
        totalCount={productPage.totalCount}
        serverPaginated
        categoryLoadMore
        categoryName={category.name}
        categoryFaqItems={categoryFaqItems}
        moreToExploreCategories={moreToExploreCategories}
        heroTitle={taxonomy?.option?.name ?? taxonomy?.subcategory.name ?? category.banner_title ?? category.name}
        heroSubtitle={category.banner_subtitle || `Browse ${category.name} from the live catalog.`}
        heroDesktopImageUrl={toPublicUrl(category.banner_desktop_image_path) || undefined}
        heroMobileImageUrl={toPublicUrl(category.banner_mobile_image_path) || undefined}
        heroImageAlt={category.banner_desktop_image_alt || category.banner_mobile_image_alt || category.name}
        heroCtaLabel={category.banner_cta_label || undefined}
        heroCtaHref={category.banner_cta_link || undefined}
        heroBannerEnabled={Boolean(category.banner_enabled)}
        masterShapeOptions={(stoneShapesResult.error ? [] : stoneShapesResult.data ?? []).map((shape) => ({
          value: shape.slug,
          label: shape.name,
          iconUrl: toPublicUrl(shape.svg_asset_url) ?? shape.svg_asset_url ?? null,
          displayOrder: shape.display_order ?? 0,
        }))}
        headerBrowseSections={headerBrowseSections}
        initialFilters={{
          ...(taxonomy?.subcategory.slug
            ? { subcategory: [taxonomy.subcategory.slug] }
            : typeof query.subcategory === 'string' ? { subcategory: [query.subcategory] } : {}),
          ...(taxonomy?.option?.slug
            ? { option: [taxonomy.option.slug] }
            : typeof query.option === 'string' ? { option: [query.option] } : {}),
          ...(typeof query.shape === 'string' ? { shape: [query.shape] } : {}),
          ...(typeof query.style === 'string' ? { style: [query.style] } : {}),
          ...(typeof query.metal === 'string' ? { metal: [query.metal] } : {}),
          ...(certificateFilterValue ? { certificate: [certificateFilterValue] } : {}),
        }}
        initialPage={productPage.page}
      />
    </>
  )
}
