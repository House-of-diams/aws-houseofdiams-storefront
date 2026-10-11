import { NextResponse } from 'next/server'
import { loadBespokeProcessCardsFromRds } from '@/lib/repositories/bespoke-repository'

export const dynamic = 'force-static'
export const revalidate = 300

async function readPublicContent() {
  return NextResponse.json({ items: await loadBespokeProcessCardsFromRds() })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
