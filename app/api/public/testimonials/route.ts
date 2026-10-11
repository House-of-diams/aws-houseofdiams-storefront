import { NextResponse } from 'next/server'
import { findTestimonialsFromRds } from '@/lib/repositories/public-cms-repository'

export const dynamic = 'force-static'
export const revalidate = 300

async function readPublicContent() {
  const result = await findTestimonialsFromRds()
  if (!result) return NextResponse.json({ eyebrow: 'Client Stories', heading: 'What Our Clients Say', items: [] })
  return NextResponse.json({ eyebrow: result.section.eyebrow, heading: result.section.heading, items: result.items })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
