import { NextResponse } from 'next/server'
import { findAdditionalSummaryFromRds } from '@/lib/repositories/summary-repository'
import { cachePublicRead, publicCacheHeaders, PUBLIC_CACHE_LONG_SECONDS } from '@/lib/public-cache'

export const dynamic = 'force-dynamic'

const readAdditionalSummary = cachePublicRead('additional-summary-details', async () => (await findAdditionalSummaryFromRds()) ?? null, PUBLIC_CACHE_LONG_SECONDS)

async function readPublicContent() {
  return NextResponse.json({ summary: await readAdditionalSummary() }, { headers: publicCacheHeaders(PUBLIC_CACHE_LONG_SECONDS) })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
