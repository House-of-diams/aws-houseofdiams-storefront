import { NextResponse } from 'next/server'
import { findHipHopHeroFromRds, loadHipHopHeroSlidesFromRds } from '@/lib/repositories/legacy-cms-repository'

export const dynamic = 'force-static'
export const revalidate = 300

async function readPublicContent() {
  try {
    const section = await findHipHopHeroFromRds()
    if (!section) return NextResponse.json({ item: null, items: [] })
    const items = await loadHipHopHeroSlidesFromRds(section.id)
    return NextResponse.json({ item: section, items })
  } catch {
    return NextResponse.json({ error: 'Unable to load Hip Hop hero.' }, { status: 500 })
  }
}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
