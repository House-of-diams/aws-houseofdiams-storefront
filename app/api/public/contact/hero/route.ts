import { NextResponse } from 'next/server'
import { findContactHeroFromRds } from '@/lib/repositories/public-cms-repository'

export const dynamic = 'force-static'
export const revalidate = 300

async function readPublicContent() {
  return NextResponse.json({ item: await findContactHeroFromRds() })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
