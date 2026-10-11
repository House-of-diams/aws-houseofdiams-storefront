import 'server-only'

import { query } from '@/lib/db/query'
import type {
  PublicCategoryRow,
  PublicCertificateRow,
  PublicMetalRow,
  PublicNavbarFeaturedCardRow,
  PublicNavbarItemRow,
  PublicNavbarSectionLinkRow,
  PublicNavbarSectionRow,
  PublicNavbarSectionSourceItemRow,
  PublicOptionRow,
  PublicStoneShapeRow,
  PublicStyleRow,
  PublicSubcategoryRow,
} from '@/lib/navbar'

async function rows<Row>(sql: string, values: readonly unknown[], operation: string): Promise<Row[]> {
  // JSONB gives the same JSON scalar/date representation as PostgREST's
  // select('*'); the existing navbar rendering logic stays unchanged.
  const result = await query<{ row: Row }>(sql, values, { operation })
  return result.rows.map((entry) => entry.row)
}

export async function loadNavbarRowsFromRds() {
  const [
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
    hiddenDirectRows,
  ] = await Promise.all([
    rows<PublicNavbarItemRow>(
      'SELECT to_jsonb(t) AS row FROM public.navbar_items t WHERE status = $1 ORDER BY display_order ASC',
      ['active'], 'navbar.items',
    ),
    rows<PublicNavbarSectionRow>(
      'SELECT to_jsonb(t) AS row FROM public.navbar_sections t WHERE status = $1 ORDER BY column_number ASC, display_order ASC',
      ['active'], 'navbar.sections',
    ),
    rows<PublicNavbarSectionLinkRow>(
      'SELECT to_jsonb(t) AS row FROM public.navbar_section_links t WHERE status = $1 ORDER BY display_order ASC',
      ['active'], 'navbar.section_links',
    ),
    rows<PublicNavbarSectionSourceItemRow>(
      'SELECT to_jsonb(t) AS row FROM public.navbar_section_source_items t WHERE is_active = $1 ORDER BY sort_order ASC',
      [true], 'navbar.section_source_items',
    ),
    rows<PublicNavbarFeaturedCardRow>(
      'SELECT to_jsonb(t) AS row FROM public.navbar_featured_cards t',
      [], 'navbar.featured_cards',
    ),
    rows<PublicCategoryRow & { show_in_nav?: boolean | null; banner_desktop_image_path?: string | null; banner_mobile_image_path?: string | null; banner_desktop_image_alt?: string | null; banner_mobile_image_alt?: string | null }>(
      'SELECT to_jsonb(t) AS row FROM public.catalog_categories t WHERE status = $1 ORDER BY display_order ASC',
      ['active'], 'navbar.categories',
    ),
    rows<PublicSubcategoryRow>(
      'SELECT to_jsonb(t) AS row FROM public.catalog_subcategories t WHERE status = $1 ORDER BY display_order ASC',
      ['active'], 'navbar.subcategories',
    ),
    rows<PublicOptionRow>(
      'SELECT to_jsonb(t) AS row FROM public.catalog_options t WHERE status = $1 ORDER BY display_order ASC',
      ['active'], 'navbar.options',
    ),
    rows<PublicMetalRow>(
      'SELECT to_jsonb(t) AS row FROM public.catalog_metals t WHERE status = $1 ORDER BY display_order ASC',
      ['active'], 'navbar.metals',
    ),
    rows<PublicStoneShapeRow>(
      'SELECT to_jsonb(t) AS row FROM public.catalog_stone_shapes t WHERE status = $1 ORDER BY display_order ASC',
      ['active'], 'navbar.stone_shapes',
    ),
    rows<PublicCertificateRow>(
      'SELECT to_jsonb(t) AS row FROM public.catalog_certificates t ORDER BY display_order ASC',
      [], 'navbar.certificates',
    ),
    rows<PublicStyleRow>(
      'SELECT to_jsonb(t) AS row FROM public.catalog_styles t WHERE status = $1 ORDER BY display_order ASC',
      ['active'], 'navbar.styles',
    ),
    query<{ slug: string }>(
      'SELECT slug FROM public.navbar_items WHERE slug = ANY($1::text[]) AND status = $2',
      [['bespoke'], 'hidden'], { operation: 'navbar.hidden_direct_slugs' },
    ).then((result) => result.rows),
  ])

  return {
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
    hiddenDirectSlugs: new Set(hiddenDirectRows.map((entry) => entry.slug)),
  }
}
