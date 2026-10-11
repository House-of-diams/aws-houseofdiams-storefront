import { NextResponse } from 'next/server'
import { findPublicSiteSettingsFromRds } from '@/lib/repositories/settings-repository'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function readPublicContent() {
  try {
    const data = await findPublicSiteSettingsFromRds()
    return NextResponse.json({
      item: {
        whatsapp_number: data?.whatsapp_number ?? '',
        maintenance_mode_enabled: Boolean(data?.maintenance_mode_enabled),
        maintenance_mode_message: data?.maintenance_mode_message ?? '',
        estimated_delivery_text: data?.estimated_delivery_text ?? 'Approximately 3 to 4 weeks',
      }
    })
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
