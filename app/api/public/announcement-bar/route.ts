import { NextResponse } from 'next/server'
import { loadPublicAnnouncementBar } from '@/lib/announcement-bar'
import { publicCacheHeaders, PUBLIC_CACHE_SHORT_SECONDS } from '@/lib/public-cache'

export const dynamic = 'force-dynamic'

async function readPublicContent() {
  return NextResponse.json(await loadPublicAnnouncementBar(), { headers: publicCacheHeaders(PUBLIC_CACHE_SHORT_SECONDS) })
}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
