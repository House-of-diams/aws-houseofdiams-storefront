import { NextResponse } from 'next/server'
import { findCouplesFromRds } from '@/lib/repositories/public-cms-repository'

export const dynamic = 'force-static'
export const revalidate = 300

async function readPublicContent() {
  const result = await findCouplesFromRds()
  if (!result) return NextResponse.json({ eyebrow: 'Love Stories', heading: 'Our Cute Couples', subtitle: 'Real couples. Real proposals. Real diamonds.', items: [] })
  return NextResponse.json({ eyebrow: result.section.eyebrow, heading: result.section.heading, subtitle: result.section.subtitle, items: result.items })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
