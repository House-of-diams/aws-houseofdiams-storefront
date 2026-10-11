import { NextResponse } from 'next/server'
import { resolveLegacyHipHopHref } from '@/lib/legacy-hiphop'
import { findHipHopShowcaseFromRds } from '@/lib/repositories/public-cms-repository'

export const dynamic = 'force-static'
export const revalidate = 300

async function readPublicContent() {

  const data = await findHipHopShowcaseFromRds()
  return NextResponse.json({
    section: {
      is_enabled: (data?.is_enabled as boolean | null) ?? true,
      eyebrow: (data?.eyebrow as string | null) ?? 'Hip Hop Collection · House of Diams',
      heading_line_1: (data?.heading_line_1 as string | null) ?? 'Ice That',
      heading_line_2: (data?.heading_line_2 as string | null) ?? 'Speaks',
      heading_emphasis: (data?.heading_emphasis as string | null) ?? 'Louder.',
      cta_label: (data?.cta_label as string | null) ?? 'Shop Iced Pieces',
      cta_link: resolveLegacyHipHopHref(data?.cta_link as string | null),
      image_path: (data?.image_path as string | null) ?? '',
      image_alt: (data?.image_alt as string | null) ?? 'House of Diams Hip Hop Collection',
    }
  })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
