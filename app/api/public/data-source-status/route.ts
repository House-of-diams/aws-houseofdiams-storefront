import { NextResponse } from 'next/server'
import { findPublicSiteSettingsFromRds } from '@/lib/repositories/settings-repository'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const settings = await findPublicSiteSettingsFromRds()
    if (!settings) {
      return NextResponse.json({ source: 'unknown', checked: false }, {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      })
    }
    return NextResponse.json({ source: 'rds', checked: true }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ source: 'unknown', checked: false }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
