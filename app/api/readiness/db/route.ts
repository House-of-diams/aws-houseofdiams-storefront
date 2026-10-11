import { NextResponse } from 'next/server'

import { checkDatabaseReadiness } from '@/lib/db/health'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const readiness = await checkDatabaseReadiness()

  return NextResponse.json(
    {
      ok: readiness.ok,
      database: readiness.ok ? 'ready' : 'unavailable',
      latencyMs: readiness.latencyMs,
    },
    {
      status: readiness.ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
