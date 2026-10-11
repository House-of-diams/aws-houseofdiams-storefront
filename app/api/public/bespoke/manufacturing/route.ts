import { NextResponse } from 'next/server'
import { loadBespokeProcessStepsFromRds } from '@/lib/repositories/bespoke-repository'
import { mediaUrl } from '@/lib/media-url'

export const dynamic = 'force-static'
export const revalidate = 300

async function readPublicContent() {

  const data: Array<{ id: number; sort_order: number; step: string | null; eyebrow: string | null; title: string | null; description: string | null; image_path: string | null; media_type: string | null; media_path: string | null }> = await loadBespokeProcessStepsFromRds()

  const toPublicUrl = mediaUrl
  const items = data.map((item) => ({
    ...item,
    media_type: item.media_type === 'video' ? 'video' : 'image',
    media_path: item.media_path || item.image_path || '',
    media_url: toPublicUrl(item.media_path || item.image_path),
    image_url: toPublicUrl(item.image_path),
  }))
  return NextResponse.json({ items })
}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
