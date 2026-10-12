import { NextResponse } from 'next/server'
import { findPublicSiteSettingsFromRds } from '@/lib/repositories/settings-repository'
import { cachePublicRead, publicCacheHeaders, PUBLIC_CACHE_SHORT_SECONDS } from '@/lib/public-cache'

export const dynamic = 'force-dynamic'

// Maintenance routing is decided in proxy.ts from its own state; this endpoint
// only feeds display values (WhatsApp number, delivery text).
const readSiteSettings = cachePublicRead('site-settings', findPublicSiteSettingsFromRds, PUBLIC_CACHE_SHORT_SECONDS)

async function readPublicContent() {
  try {
    const data = await readSiteSettings()
    return NextResponse.json({
      item: {
        whatsapp_number: data?.whatsapp_number ?? '',
        maintenance_mode_enabled: Boolean(data?.maintenance_mode_enabled),
        maintenance_mode_message: data?.maintenance_mode_message ?? '',
        estimated_delivery_text: data?.estimated_delivery_text ?? 'Approximately 3 to 4 weeks',
      }
    }, { headers: publicCacheHeaders(PUBLIC_CACHE_SHORT_SECONDS) })
  } catch {
    return NextResponse.json({ error: 'Unable to load site settings.' }, { status: 500 })
  }

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
