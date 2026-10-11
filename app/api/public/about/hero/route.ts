import { NextResponse } from 'next/server'
import { findAboutHeroFromRds } from '@/lib/repositories/about-repository'
import { mediaUrl } from '@/lib/media-url'

export const dynamic = 'force-static'
export const revalidate = 300

async function readPublicContent() {

  const { data, error } = { data: await findAboutHeroFromRds(), error: null as { code?: string; message: string } | null }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const url = mediaUrl
  return NextResponse.json(data ? { ...data, desktop_media_url: url(data.desktop_media_path), mobile_media_url: url(data.mobile_media_path || data.desktop_media_path), video_poster_url: url(data.video_poster_path) } : null)
}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
