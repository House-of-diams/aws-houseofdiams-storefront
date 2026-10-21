import 'server-only'

import { findAnnouncementBarFromRds } from '@/lib/repositories/public-cms-repository'
import { cachePublicRead, PUBLIC_CACHE_SHORT_SECONDS } from '@/lib/public-cache'

export type PublicAnnouncementBar = {
  active: boolean
  autoplay: boolean
  intervalMs: number
  items: Array<{ message: string; linkUrl: string; openInNewTab: boolean }>
}

// One shared cached read for the page render and for /api/public/announcement-bar.
const readAnnouncementBar = cachePublicRead('announcement-bar', async () => (await findAnnouncementBarFromRds()) ?? null, PUBLIC_CACHE_SHORT_SECONDS)

export async function loadPublicAnnouncementBar(): Promise<PublicAnnouncementBar> {
  const result = await readAnnouncementBar()
  if (!result) return { active: false, autoplay: false, intervalMs: 3000, items: [] }
  return {
    active: Boolean(result.section.is_active),
    autoplay: Boolean(result.section.autoplay),
    intervalMs: 3000,
    items: result.items.map((item) => ({ message: item.message, linkUrl: item.link_url ?? '', openInNewTab: Boolean(item.open_in_new_tab) })),
  }
}
