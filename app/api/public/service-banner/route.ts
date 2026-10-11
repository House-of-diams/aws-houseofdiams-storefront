import { NextResponse } from 'next/server'
import { loadServiceBannerFromRds } from '@/lib/repositories/public-cms-repository'
import { mediaUrl } from '@/lib/media-url'

export const dynamic = 'force-dynamic'

async function readPublicContent() {
  const { section, blocks } = await loadServiceBannerFromRds()
  if (!section?.image_path || !blocks.length) return NextResponse.json({ section: null, blocks: [] }, { headers: { 'Cache-Control': 'no-store' } })

  const imageUrl = mediaUrl(section.image_path)
  return NextResponse.json({ section: { imageUrl, imageAlt: section.image_alt ?? '' }, blocks }, { headers: { 'Cache-Control': 'no-store' } })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
