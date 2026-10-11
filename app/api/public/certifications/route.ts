import { NextResponse } from 'next/server'
import { findCertificationsFromRds } from '@/lib/repositories/public-cms-repository'

export const dynamic = 'force-static'
export const revalidate = 300

async function readPublicContent() {
  const { section, items } = await findCertificationsFromRds()
  return NextResponse.json({ section: section ?? { section_key: 'home_certifications', eyebrow: 'Our Promise', heading: 'Why Choose House of Diams' }, items })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
