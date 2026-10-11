import { buildCategoryPath, buildOptionPath, buildSubcategoryPath } from '@/lib/catalog-paths'
import { mediaUrl } from '@/lib/media-url'

export type NavbarSectionType =
  | 'category_list'
  | 'manual_links'
  | 'metal_swatches'
  | 'stone_shapes'
  | 'certificates'
  | 'styles'
  | 'category_link'

export type PublicNavbarItemRow = {
  id: string
  label: string
  slug: string
  item_type: 'mega_menu' | 'direct_link'
  linked_category_id: string | null
  direct_link_url: string | null
  display_order: number
  status: 'active' | 'hidden'
}

export type PublicNavbarSectionRow = {
  id: string
  navbar_item_id: string
  title: string
  icon_svg_path?: string | null
  section_type: NavbarSectionType
  source_subcategory_id: string | null
  source_category_slug?: string | null
  enable_category_link?: boolean | null
  linked_category_id?: string | null
  column_number: number
  show_as_filter?: boolean | null
  display_order: number
  status: 'active' | 'hidden'
}

export type PublicNavbarSectionSourceItemRow = {
  section_id: string
  source_kind: 'subcategory_option' | 'metal' | 'stone_shape' | 'certificate' | 'style'
  source_item_id: string
  sort_order: number
  is_active: boolean
}

export type PublicCategoryRow = {
  id: string
  name: string
  slug: string
  nav_type?: 'mega_menu' | 'direct_link' | null
  direct_link_url?: string | null
  display_order: number
  status: 'active' | 'hidden'
}

export type PublicNavbarSectionLinkRow = {
  id: string
  section_id: string
  label: string
  url: string
  display_order: number
  status: 'active' | 'hidden'
}

export type PublicNavbarFeaturedCardRow = {
  navbar_item_id: string
  image_path: string | null
  image_alt: string | null
  button_label: string | null
  button_url: string | null
  enabled: boolean
}

export type PublicSubcategoryRow = {
  id: string
  category_id: string
  name: string
  slug: string
  icon_svg_path?: string | null
  image_path?: string | null
  image_alt?: string | null
  display_order: number
  status: 'active' | 'hidden'
}

export type PublicOptionRow = {
  id: string
  subcategory_id: string
  name: string
  slug: string
  icon_svg_path?: string | null
  image_path?: string | null
  image_alt?: string | null
  display_order: number
  status: 'active' | 'hidden'
}

export type PublicMetalRow = {
  id: string
  name: string
  slug: string
  color_hex?: string | null
  display_order: number
  status: 'active' | 'hidden'
}

export type PublicStoneShapeRow = {
  id: string
  name: string
  slug: string
  svg_asset_url: string | null
  display_order: number
  status: 'active' | 'hidden'
}

export type PublicCertificateRow = {
  id: string
  name: string
  code?: string | null
  slug?: string | null
  display_order?: number | null
  status?: 'active' | 'hidden'
}

export type PublicStyleRow = {
  id: string
  name: string
  slug: string
  icon_svg_path?: string | null
  display_order: number
  status: 'active' | 'hidden'
}

export type NavbarRenderLink = {
  label: string
  href: string
  iconUrl?: string | null
  colorHex?: string | null
  isCategoryLink?: boolean
  type?: 'default' | 'swatch' | 'icon'
}

export type NavbarRenderSection = {
  id: string
  title: string
  iconUrl?: string | null
  type: NavbarSectionType
  showAsFilter?: boolean
  twoCol?: boolean
  links?: NavbarRenderLink[]
  metals?: readonly ({ type: 'yellow' | 'rose' | 'white' | 'platinum' | 'default'; label: string; href: string; colorHex?: string | null })[]
}

export type NavbarRenderItem = {
  slug?: string
  linkedCategoryId?: string | null
  label: string
  href?: string
  navigationType?: 'mega_menu' | 'direct_link'
  mega?: {
    cols: number
    sections: NavbarRenderSection[]
    featuredImage?: {
      imageUrl: string
      imageAlt: string
      buttonLabel: string
      buttonUrl: string
    } | null
  }
}

function resolveStoragePublicUrl(path: string | null | undefined) {
  return path ? mediaUrl(path) : null
}

const METAL_TYPE_MAP: Record<string, 'yellow' | 'rose' | 'white' | 'platinum'> = {
  'yellow-gold': 'yellow',
  '18k-yellow-gold': 'yellow',
  '14k-yellow-gold': 'yellow',
  'yellow_gold': 'yellow',
  yellow: 'yellow',
  'rose-gold': 'rose',
  '18k-rose-gold': 'rose',
  '14k-rose-gold': 'rose',
  'rose_gold': 'rose',
  rose: 'rose',
  'white-gold': 'white',
  '18k-white-gold': 'white',
  '14k-white-gold': 'white',
  'white_gold': 'white',
  white: 'white',
  platinum: 'platinum',
}

const DEFAULT_DIRECT_NAV_ITEMS: NavbarRenderItem[] = [
  { slug: 'bespoke', label: 'Bespoke', href: '/bespoke' },
]

function getMetalType(entry: Pick<PublicMetalRow, 'slug' | 'name'>): 'yellow' | 'rose' | 'white' | 'platinum' | 'default' {
  const candidates = [
    entry.slug,
    entry.slug?.replace(/_/g, '-'),
    slugifyValue(entry.name),
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const directMatch = METAL_TYPE_MAP[candidate]
    if (directMatch) return directMatch

    if (candidate.includes('yellow')) return 'yellow'
    if (candidate.includes('rose')) return 'rose'
    if (candidate.includes('white')) return 'white'
    if (candidate.includes('platinum')) return 'platinum'
  }

  return 'default'
}

function buildItemBaseHref(slug: string) {
  return buildCategoryPath({ slug })
}

function buildCategoryFilterHref(itemHref: string, filterKey: 'shape' | 'style' | 'certificate' | 'metal', value: string) {
  return `${itemHref}?${filterKey}=${encodeURIComponent(value)}`
}

function slugifyValue(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function buildCategoryListLinks(args: {
  category: PublicCategoryRow
  subcategory: PublicSubcategoryRow
  options: PublicOptionRow[]
}): NavbarRenderLink[] {
  const { category, subcategory, options } = args
  return options
    .filter((entry) => entry.subcategory_id === subcategory.id && entry.status === 'active')
    .sort((left, right) => left.display_order - right.display_order)
    .map((entry) => {
      const iconUrl = resolveStoragePublicUrl(entry.image_path ?? entry.icon_svg_path)
      return {
        label: entry.name,
        href: buildOptionPath(category, subcategory, entry),
        iconUrl,
        type: iconUrl ? 'icon' : 'default',
      }
    })
}

function buildStoneShapeLinks(itemHref: string, stoneShapes: PublicStoneShapeRow[]): NavbarRenderLink[] {
  return stoneShapes
    .filter((entry) => entry.status === 'active')
    .sort((left, right) => left.display_order - right.display_order)
    .map((entry) => ({
      label: entry.name,
      href: buildCategoryFilterHref(itemHref, 'shape', entry.slug || slugifyValue(entry.name)),
      iconUrl: resolveStoragePublicUrl(entry.svg_asset_url),
      type: resolveStoragePublicUrl(entry.svg_asset_url) ? 'icon' : 'default',
    }))
}

function filterBySelectedIds<T extends { id: string }>(items: T[], selectedIds: Set<string>) {
  if (selectedIds.size === 0) return items
  return items.filter((entry) => selectedIds.has(entry.id))
}

function buildCertificateLinks(itemHref: string, certificates: PublicCertificateRow[]): NavbarRenderLink[] {
  return certificates
    .filter((entry) => !entry.status || entry.status === 'active')
    .sort((left, right) => (left.display_order ?? 0) - (right.display_order ?? 0))
    .map((entry) => ({
      label: entry.name,
      href: buildCategoryFilterHref(itemHref, 'certificate', slugifyValue(entry.slug || entry.name)),
    }))
}

function buildStyleLinks(itemHref: string, styles: PublicStyleRow[]): NavbarRenderLink[] {
  return styles
    .filter((entry) => entry.status === 'active')
    .sort((left, right) => left.display_order - right.display_order)
    .map((entry) => {
      const iconUrl = resolveStoragePublicUrl(entry.icon_svg_path)
      return {
        label: entry.name,
        href: buildCategoryFilterHref(itemHref, 'style', entry.slug || slugifyValue(entry.name)),
        iconUrl,
        type: iconUrl ? 'icon' : 'default',
      }
    })
}

function buildMetalLinks(itemHref: string, metals: PublicMetalRow[]) {
  const activeMetals = metals
    .filter((entry) => entry.status === 'active')
    .sort((left, right) => left.display_order - right.display_order)

  return {
    metals: activeMetals.map((entry) => ({
      type: getMetalType(entry),
      label: entry.name,
      href: buildCategoryFilterHref(itemHref, 'metal', entry.slug || slugifyValue(entry.name)),
      colorHex: entry.color_hex ?? null,
    })),
  }
}

export function buildNavbarRenderItems(args: {
  items: PublicNavbarItemRow[]
  sections: PublicNavbarSectionRow[]
  sectionLinks: PublicNavbarSectionLinkRow[]
  sectionSourceItems: PublicNavbarSectionSourceItemRow[]
  featuredCards: PublicNavbarFeaturedCardRow[]
  categories: PublicCategoryRow[]
  subcategories: PublicSubcategoryRow[]
  options: PublicOptionRow[]
  metals: PublicMetalRow[]
  stoneShapes: PublicStoneShapeRow[]
  certificates?: PublicCertificateRow[]
  styles?: PublicStyleRow[]
}): NavbarRenderItem[] {
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
    certificates = [],
    styles = [],
  } = args
  const categoriesById = new Map(categories.map((entry) => [entry.id, entry]))
  const subcategoriesById = new Map(subcategories.map((entry) => [entry.id, entry]))
  const optionsBySubcategory = new Map<string, PublicOptionRow[]>()
  const sourceItemsBySection = new Map<string, PublicNavbarSectionSourceItemRow[]>()

  options
    .filter((entry) => entry.status === 'active')
    .forEach((entry) => {
      const existing = optionsBySubcategory.get(entry.subcategory_id) ?? []
      existing.push(entry)
      optionsBySubcategory.set(entry.subcategory_id, existing)
    })

  sectionSourceItems
    .filter((entry) => entry.is_active)
    .forEach((entry) => {
      const existing = sourceItemsBySection.get(entry.section_id) ?? []
      existing.push(entry)
      sourceItemsBySection.set(entry.section_id, existing)
    })

  const dynamicItems = items
    .filter((entry) => entry.status === 'active')
    .sort((left, right) => left.display_order - right.display_order)
    .map((item) => {
      const itemHref = item.direct_link_url ?? buildItemBaseHref(item.slug)
      const itemCategorySlug = (item.linked_category_id ? categoriesById.get(item.linked_category_id)?.slug : null) ?? item.slug
      const itemCategory = (item.linked_category_id ? categoriesById.get(item.linked_category_id) : null)
        ?? categories.find((entry) => entry.slug === itemCategorySlug)
      const visibleSections = sections
        .filter((entry) => entry.navbar_item_id === item.id && entry.status === 'active')
        .sort((left, right) => {
          if (left.column_number !== right.column_number) {
            return left.column_number - right.column_number
          }
          return left.display_order - right.display_order
        })

      const isDirectLink = item.item_type !== 'mega_menu' || itemCategory?.nav_type === 'direct_link'

      if (isDirectLink) {
        return {
          slug: item.slug,
          linkedCategoryId: item.linked_category_id,
          label: item.label,
          href: itemCategory?.nav_type === 'direct_link'
            ? itemCategory.direct_link_url ?? item.direct_link_url ?? buildItemBaseHref(item.slug)
            : item.direct_link_url ?? buildItemBaseHref(item.slug),
          navigationType: 'direct_link' as const,
        }
      }

      const itemSections = visibleSections
        .map((section) => {
          const subcategory = section.source_subcategory_id ? subcategoriesById.get(section.source_subcategory_id) : null
          const selectedItems = (sourceItemsBySection.get(section.id) ?? []).sort((left, right) => left.sort_order - right.sort_order)
          const selectedIds = new Set(selectedItems.map((entry) => entry.source_item_id))
          const injectedCategory =
            section.enable_category_link && section.linked_category_id
              ? categoriesById.get(section.linked_category_id)
              : null
          const categoryLink: NavbarRenderLink[] = injectedCategory
            ? [
              {
                label: injectedCategory.name,
                href: buildCategoryPath(injectedCategory),
                isCategoryLink: true,
              },
            ]
            : []

          if (section.section_type === 'manual_links') {
            return {
              id: section.id,
              title: section.title,
              iconUrl: resolveStoragePublicUrl(section.icon_svg_path),
              type: section.section_type,
              showAsFilter: section.show_as_filter ?? false,
              links: sectionLinks
                .filter((entry) => entry.section_id === section.id && entry.status === 'active')
                .sort((left, right) => left.display_order - right.display_order)
                .map((entry) => ({
                  label: entry.label,
                  href: entry.url,
                })),
            } satisfies NavbarRenderSection
          }

          if (section.section_type === 'stone_shapes') {
            const selectedStoneShapes = filterBySelectedIds(stoneShapes, selectedIds)
            const shapeLinks = buildStoneShapeLinks(
              itemHref,
              selectedStoneShapes.length > 0 ? selectedStoneShapes : stoneShapes
            )
            return {
              id: section.id,
              title: section.title,
              iconUrl: resolveStoragePublicUrl(section.icon_svg_path),
              type: section.section_type,
              showAsFilter: section.show_as_filter ?? false,
              twoCol: true,
              links: [...shapeLinks, ...categoryLink],
            } satisfies NavbarRenderSection
          }

          if (section.section_type === 'certificates') {
            const certificateLinks = buildCertificateLinks(itemHref, filterBySelectedIds(certificates, selectedIds))
            return {
              id: section.id,
              title: section.title,
              iconUrl: resolveStoragePublicUrl(section.icon_svg_path),
              type: section.section_type,
              showAsFilter: section.show_as_filter ?? false,
              links: [...certificateLinks, ...categoryLink],
            } satisfies NavbarRenderSection
          }

          if (section.section_type === 'styles') {
            const styleLinks = buildStyleLinks(itemHref, filterBySelectedIds(styles, selectedIds))
            return {
              id: section.id,
              title: section.title,
              iconUrl: resolveStoragePublicUrl(section.icon_svg_path),
              type: section.section_type,
              showAsFilter: section.show_as_filter ?? false,
              twoCol: true,
              links: [...styleLinks, ...categoryLink],
            } satisfies NavbarRenderSection
          }

          if (section.section_type === 'metal_swatches') {
            const metalData = buildMetalLinks(
              itemHref,
              metals.filter((entry) => selectedIds.size === 0 || selectedIds.has(entry.id))
            )
            return {
              id: section.id,
              title: section.title,
              iconUrl: resolveStoragePublicUrl(section.icon_svg_path),
              type: section.section_type,
              showAsFilter: section.show_as_filter ?? false,
              twoCol: true,
              metals: metalData.metals,
              links: categoryLink,
            } satisfies NavbarRenderSection
          }

          if (section.section_type === 'category_link' && section.source_category_slug) {
            return {
              id: section.id,
              title: section.title,
              iconUrl: resolveStoragePublicUrl(section.icon_svg_path),
              type: section.section_type,
              showAsFilter: section.show_as_filter ?? false,
              links: [
                {
                  label: section.title,
                  href: buildCategoryPath({ slug: section.source_category_slug }),
                  isCategoryLink: true,
                },
              ],
            } satisfies NavbarRenderSection
          }

          const subcategoryOptions = subcategory ? (optionsBySubcategory.get(subcategory.id) ?? []).sort((left, right) => left.display_order - right.display_order) : []
          const filteredSubcategoryOptions = subcategoryOptions.filter((entry) => selectedIds.size === 0 || selectedIds.has(entry.id))

          const links = subcategory
            ? filteredSubcategoryOptions.length > 0
              ? itemCategory
                ? buildCategoryListLinks({ category: itemCategory, subcategory, options: filteredSubcategoryOptions })
                : []
              : [
                {
                  label: subcategory.name,
                  href: itemCategory ? buildSubcategoryPath(itemCategory, subcategory) : itemHref,
                  iconUrl: resolveStoragePublicUrl(subcategory.image_path ?? subcategory.icon_svg_path),
                  type: resolveStoragePublicUrl(subcategory.image_path ?? subcategory.icon_svg_path) ? 'icon' : 'default',
                } satisfies NavbarRenderLink,
              ]
            : []

          return {
            id: section.id,
            title: section.title,
            iconUrl: resolveStoragePublicUrl(section.icon_svg_path),
            type: section.section_type,
            showAsFilter: section.show_as_filter ?? false,
            links: [...links, ...categoryLink],
          } satisfies NavbarRenderSection
        })
        .filter((section) => {
          if (section.showAsFilter) return true
          if (section.type === 'metal_swatches') return (section.metals?.length ?? 0) > 0 || (section.links?.length ?? 0) > 0
          return (section.links?.length ?? 0) > 0
        })

      const fallbackSections =
        itemSections.length === 0 && item.linked_category_id
          ? subcategories
            .filter((entry) => entry.category_id === item.linked_category_id && entry.status === 'active')
            .sort((left, right) => left.display_order - right.display_order)
            .map((subcategory) => ({
              id: `fallback-${item.id}-${subcategory.id}`,
              title: subcategory.name,
              iconUrl: resolveStoragePublicUrl(subcategory.image_path ?? subcategory.icon_svg_path),
              type: 'category_list' as const,
              links: itemCategory
                ? buildCategoryListLinks({
                  category: itemCategory,
                  subcategory,
                  options: optionsBySubcategory.get(subcategory.id) ?? [],
                })
                : [],
              showAsFilter: false,
            }))
            .filter((section) => (section.links?.length ?? 0) > 0)
          : []
      const renderedSections = itemSections.length > 0 ? itemSections : fallbackSections
      const featuredCard = featuredCards.find((entry) => entry.navbar_item_id === item.id && entry.enabled)

      return {
        slug: item.slug,
        linkedCategoryId: item.linked_category_id,
        label: item.label,
        href: itemHref,
        navigationType: 'mega_menu' as const,
        mega: {
          cols: Math.max(1, ...renderedSections.map((_, index) => visibleSections[index]?.column_number ?? index + 1)),
          sections: renderedSections,
          featuredImage: featuredCard?.image_path
            ? {
              imageUrl: resolveStoragePublicUrl(featuredCard.image_path) ?? featuredCard.image_path,
              imageAlt: featuredCard.image_alt ?? item.label,
              buttonLabel: featuredCard.button_label ?? '',
              buttonUrl: featuredCard.button_url ?? buildItemBaseHref(item.slug),
            }
            : null,
        },
      }
    })

  const configuredSlugs = new Set(items.map((item) => item.slug))
  const missingDefaultDirectItems = DEFAULT_DIRECT_NAV_ITEMS.filter((item) => item.slug && !configuredSlugs.has(item.slug))

  return [...dynamicItems, ...missingDefaultDirectItems]
}
