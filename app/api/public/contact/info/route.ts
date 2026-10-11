import { NextResponse } from 'next/server'
import { loadContactInfoFromRds } from '@/lib/repositories/support-repository'

export const revalidate = 300
export const dynamic = 'force-static'

async function readPublicContent() {
  return NextResponse.json({ items: await loadContactInfoFromRds() }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
