import { isF7ReadPreviewEnabled } from '@/lib/f7-read-preview'
import { handleF7ProfileOrders } from '@/lib/f7-result-handlers'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (!isF7ReadPreviewEnabled()) return NextResponse.json({ error: 'Checkout is temporarily unavailable.' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  return handleF7ProfileOrders(request)
}
