import { NextResponse } from 'next/server'
import { findAnnouncementBarFromRds } from '@/lib/repositories/public-cms-repository'
import { cachePublicRead, publicCacheHeaders, PUBLIC_CACHE_SHORT_SECONDS } from '@/lib/public-cache'

export const dynamic = 'force-dynamic'

type AnnouncementItem = {
  message: string
  linkUrl: string
  openInNewTab: boolean
}

const readAnnouncementBar = cachePublicRead('announcement-bar', async () => (await findAnnouncementBarFromRds()) ?? null, PUBLIC_CACHE_SHORT_SECONDS)

async function readPublicContent() {
  const headers = publicCacheHeaders(PUBLIC_CACHE_SHORT_SECONDS)
  const result = await readAnnouncementBar()
  if (!result) return NextResponse.json({ active: false, autoplay: false, intervalMs: 3000, items: [] as AnnouncementItem[] }, { headers })
  return NextResponse.json({
    active: Boolean(result.section.is_active), autoplay: Boolean(result.section.autoplay), intervalMs: 3000,
    items: result.items.map((item): AnnouncementItem => ({ message: item.message, linkUrl: item.link_url ?? '', openInNewTab: Boolean(item.open_in_new_tab) })),
  }, { headers })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
