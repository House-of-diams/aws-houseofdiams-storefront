import { NextResponse } from 'next/server'
import { findBespokeHeroFromRds, loadBespokeHeroSlidesFromRds } from '@/lib/repositories/bespoke-repository'

export const dynamic = 'force-static'
export const revalidate = 300

async function readPublicContent() {
  const { item: section, hasSliderColumn } = await findBespokeHeroFromRds()
  if (!section) return NextResponse.json({ item: null, items: [] })
  const items = await loadBespokeHeroSlidesFromRds(String(section.id))
  return NextResponse.json({
    item: {
      badge_text: section.badge_text ?? '', eyebrow: section.eyebrow ?? '',
      heading_line_1: section.heading_line_1 ?? '', heading_line_2: section.heading_line_2 ?? '',
      subtitle: section.subtitle ?? '', primary_cta_label: section.primary_cta_label ?? '',
      primary_cta_action: section.primary_cta_action ?? '', secondary_cta_label: section.secondary_cta_label ?? '',
      secondary_cta_action: section.secondary_cta_action ?? '',
      slider_enabled: hasSliderColumn ? Boolean(section.slider_enabled) : items.some((item) => String(item.image_path ?? '').trim()),
      status: section.status,
    },
    items,
  })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
