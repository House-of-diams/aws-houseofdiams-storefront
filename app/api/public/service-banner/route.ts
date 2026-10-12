import { NextResponse } from 'next/server'
import { loadServiceBannerFromRds } from '@/lib/repositories/public-cms-repository'
import { mediaUrl } from '@/lib/media-url'
import { cachePublicRead, publicCacheHeaders, PUBLIC_CACHE_LONG_SECONDS } from '@/lib/public-cache'

export const dynamic = 'force-dynamic'

const readServiceBanner = cachePublicRead('service-banner', loadServiceBannerFromRds, PUBLIC_CACHE_LONG_SECONDS)

async function readPublicContent() {
  const headers = publicCacheHeaders(PUBLIC_CACHE_LONG_SECONDS)
  const { section, blocks } = await readServiceBanner()
  if (!section?.image_path || !blocks.length) return NextResponse.json({ section: null, blocks: [] }, { headers })

  const imageUrl = mediaUrl(section.image_path)
  return NextResponse.json({ section: { imageUrl, imageAlt: section.image_alt ?? '' }, blocks }, { headers })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
