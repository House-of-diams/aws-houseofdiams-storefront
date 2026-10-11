import { NextResponse } from 'next/server'
import {
  findHomeTestimonialMarquee,
  listTestimonialMarqueeItems,
} from '@/lib/repositories/cms-repository'

export const dynamic = 'force-static'
export const revalidate = 300

async function readPublicContent() {
  // Enable only after the corresponding two-table RLS proposal is applied and
  // read/output parity is verified. The default path remains unchanged.
  try {
    const marquee = await findHomeTestimonialMarquee()
    if (!marquee) {
      return NextResponse.json({ title: 'Loved by Clients Worldwide', items: [] })
    }
    return NextResponse.json({
      title: marquee.title,
      items: await listTestimonialMarqueeItems(marquee.id),
    })
  } catch {
    return NextResponse.json({ error: 'Unable to load testimonial marquee.' }, { status: 500 })
  }

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
