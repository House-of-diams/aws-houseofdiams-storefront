import 'server-only'

import { query } from '@/lib/db/query'

type ProductTaxRow = { slug: string; gst_slab_id: string | null }
type GstRow = { id: string; name: string; percentage: string | number | null }
type TaxInfo = { gstLabel: string; gstPercentage: number }

const DEFAULT_TAX: TaxInfo = { gstLabel: 'Taxes', gstPercentage: 0 }

export async function loadCheckoutTaxFromRds(slugs: string[]): Promise<Record<string, TaxInfo>> {
  if (!slugs.length) return {}

  const [productResult, settingsResult] = await Promise.all([
    query<ProductTaxRow>(
      'select slug, gst_slab_id from public.products where slug = any($1::text[])',
      [slugs], { operation: 'checkout.tax.products' },
    ),
    query<{ default_gst_slab_id: string | null }>(
      'select default_gst_slab_id from public.site_settings where settings_key = $1 limit 2',
      ['global_site_settings'], { operation: 'checkout.tax.settings' },
    ),
  ])
  if (settingsResult.rows.length > 1) throw new Error('Expected one checkout tax setting.')

  const bySlug = new Map(productResult.rows.map((row) => [row.slug, row]))
  const defaultId = settingsResult.rows[0]?.default_gst_slab_id ?? null
  const ids = [...new Set(slugs.map((slug) => bySlug.get(slug)?.gst_slab_id ?? defaultId).filter((id): id is string => Boolean(id)))]
  const slabs = ids.length
    ? (await query<GstRow>(
      'select id, name, percentage from public.catalog_gst_slabs where id = any($1::uuid[])',
      [ids], { operation: 'checkout.tax.slabs' },
    )).rows
    : []
  const byId = new Map(slabs.map((slab) => [slab.id, slab]))
  const needsFallback = slugs.some((slug) => !byId.has(bySlug.get(slug)?.gst_slab_id ?? defaultId ?? ''))
  const fallback = needsFallback
    ? (await query<GstRow>(
      `select id, name, percentage from public.catalog_gst_slabs
       where status <> $1 order by display_order asc limit 1`,
      ['hidden'], { operation: 'checkout.tax.fallback' },
    )).rows[0] ?? null
    : null

  return Object.fromEntries(slugs.map((slug) => {
    const slab = byId.get(bySlug.get(slug)?.gst_slab_id ?? defaultId ?? '') ?? fallback
    return [slug, slab
      ? { gstLabel: slab.name || 'Taxes', gstPercentage: Number(slab.percentage || 0) }
      : DEFAULT_TAX]
  }))
}
