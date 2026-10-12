import { NextResponse } from 'next/server'
import { getCachedHomeHeroContent } from '@/lib/home-data'
import { publicCacheHeaders, PUBLIC_CACHE_SHORT_SECONDS } from '@/lib/public-cache'

export const dynamic = 'force-dynamic'

export async function GET() {
  const content = await getCachedHomeHeroContent()
  return NextResponse.json({ content: content ?? undefined }, { headers: publicCacheHeaders(PUBLIC_CACHE_SHORT_SECONDS) })
}
