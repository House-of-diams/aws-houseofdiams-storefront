import 'server-only'

import { unstable_cache } from 'next/cache'
import { buildNavbarRenderItems, type NavbarRenderItem } from '@/lib/navbar'
import { loadNavbarRowsFromRds } from '@/lib/repositories/navbar-repository'

async function loadNavbarRenderItems(): Promise<NavbarRenderItem[]> {
  const data = await loadNavbarRowsFromRds()
  if (!data) return []

  const {
    items,
    sections,
    sectionLinks,
    sectionSourceItems,
    featuredCards,
    categories,
    subcategories,
    options,
    metals,
    stoneShapes,
    certificates,
    styles,
    hiddenDirectSlugs,
  } = data

  const fallbackItems: NavbarRenderItem[] = categories
    .filter((entry) => entry.show_in_nav !== false && entry.slug !== 'hiphop')
    .map((entry) => ({
      label: entry.name,
      href: entry.nav_type === 'direct_link' && entry.direct_link_url ? entry.direct_link_url : `/${entry.slug}`,
      navigationType: entry.nav_type === 'direct_link' ? 'direct_link' as const : 'mega_menu' as const,
    }))

  const savedNavItems =
    items.length > 0
      ? buildNavbarRenderItems({
        items,
        sections,
        sectionLinks,
        sectionSourceItems,
        featuredCards,
        categories,
        subcategories,
        options,
        metals,
        stoneShapes,
        certificates,
        styles,
      })
      : fallbackItems

  const existingHrefs = new Set(savedNavItems.map((item) => item.href).filter(Boolean))
  const mergedNavItems =
    items.length > 0
      ? [...savedNavItems, ...fallbackItems.filter((item) => item.href && !existingHrefs.has(item.href))]
      : fallbackItems

  const activeCategoryIds = new Set(categories.map((entry) => entry.id))
  const activeCategorySlugs = new Set(categories.map((entry) => entry.slug))
  const alwaysAllowedHrefs = new Set(['/bespoke'])

  return mergedNavItems.filter((item) => {
    if (item.slug === 'hiphop' || item.href === '/hiphop') return false
    if (item.linkedCategoryId) return activeCategoryIds.has(item.linkedCategoryId)
    if (item.slug && hiddenDirectSlugs.has(item.slug)) return false
    if (!item.href) return true
    if (alwaysAllowedHrefs.has(item.href)) return true

    if (item.href.startsWith('/') && !item.href.includes('?')) {
      const slug = item.href.slice(1)
      if (slug && item.mega) return activeCategorySlugs.has(slug)
    }

    return true
  })
}

const getCachedNavbarRenderItems = unstable_cache(
  loadNavbarRenderItems,
  ['site-navbar-render-items'],
  { revalidate: 300, tags: ['site-navbar'] }
)

export function getNavbarRenderItems() {

  return getCachedNavbarRenderItems()
}
