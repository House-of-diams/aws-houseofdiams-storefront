import 'server-only'

import { query } from '@/lib/db/query'

export type PageSeoRow = {
  page_key: string
  seo_title: string | null
  seo_description: string | null
  og_image_path: string | null
  seo_indexable: boolean
}

export type SiteSeoSettingsRow = {
  org_name: string | null
  org_logo_path: string | null
  org_same_as: string[] | null
  default_og_image_path: string | null
  google_site_verification: string | null
  bing_site_verification: string | null
}

export async function loadPageSeoRowsFromRds(): Promise<PageSeoRow[]> {
  const result = await query<PageSeoRow>(
    'SELECT page_key, seo_title, seo_description, og_image_path, seo_indexable FROM public.page_seo',
    [],
    { operation: 'seo.page_seo' },
  )
  return result.rows
}

export async function findSiteSeoSettingsFromRds(): Promise<SiteSeoSettingsRow | null> {
  const result = await query<SiteSeoSettingsRow>(
    `SELECT org_name, org_logo_path, org_same_as, default_og_image_path,
            google_site_verification, bing_site_verification
       FROM public.site_settings WHERE settings_key = $1 LIMIT 1`,
    ['global_site_settings'],
    { operation: 'seo.site_settings' },
  )
  return result.rows[0] ?? null
}
