import { NextResponse } from 'next/server'
import { findAnnouncementBarFromRds } from '@/lib/repositories/public-cms-repository'

export const dynamic = 'force-dynamic'

type AnnouncementItem = {
  message: string
  linkUrl: string
  openInNewTab: boolean
}

async function readPublicContent() {
  const result = await findAnnouncementBarFromRds()
  if (!result) return NextResponse.json({ active: false, autoplay: false, intervalMs: 3000, items: [] }, { headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json({
    active: Boolean(result.section.is_active), autoplay: Boolean(result.section.autoplay), intervalMs: 3000,
    items: result.items.map((item) => ({ message: item.message, linkUrl: item.link_url ?? '', openInNewTab: Boolean(item.open_in_new_tab) })),
  }, { headers: { 'Cache-Control': 'no-store' } })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
