import { isF7WritePrepared } from '@/lib/f7-write-prepared'
import { handleF7Place } from '@/lib/f7-checkout-handlers'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isF7WritePrepared()) return NextResponse.json({ error: 'Checkout is temporarily unavailable.' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  return handleF7Place(request)
}
