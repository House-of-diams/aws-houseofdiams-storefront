import 'server-only'

import { query } from '@/lib/db/query'

export type PublicSiteSettings = {
  whatsapp_number: string | null
  maintenance_mode_enabled: boolean | null
  maintenance_mode_message: string | null
  estimated_delivery_text: string | null
}

export async function findPublicSiteSettingsFromRds(): Promise<PublicSiteSettings | null> {
  const result = await query<PublicSiteSettings>(
    `SELECT whatsapp_number, maintenance_mode_enabled, maintenance_mode_message,
            estimated_delivery_text FROM public.site_settings
      WHERE settings_key = $1 LIMIT 2`,
    ['global_site_settings'], { operation: 'settings.public' },
  )
  if (result.rows.length > 1) throw new Error('Expected one global site settings row.')
  return result.rows[0] ?? null
}
