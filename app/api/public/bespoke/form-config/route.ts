import { NextResponse } from 'next/server'
import { loadBespokeFormConfigFromRds } from '@/lib/repositories/bespoke-repository'

export const dynamic = 'force-dynamic'

async function readPublicContent() {
  const { settings, guarantees, pieceTypes, stoneOptions, caratOptions, metalOptions } = await loadBespokeFormConfigFromRds()
  return NextResponse.json({ settings, guarantees, pieceTypes, stoneOptions, caratOptions, metalOptions }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
