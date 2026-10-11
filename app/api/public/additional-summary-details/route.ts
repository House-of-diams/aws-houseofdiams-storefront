import { NextResponse } from 'next/server'
import { findAdditionalSummaryFromRds } from '@/lib/repositories/summary-repository'

export const dynamic = 'force-dynamic'

async function readPublicContent() {
  return NextResponse.json({ summary: await findAdditionalSummaryFromRds() })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
