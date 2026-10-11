import { isF8Prepared } from '@/lib/f8-prepared'
import { runRdsReconciliation } from '@/lib/f8-reconciliation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (!isF8Prepared()) return Response.json({ error: 'RDS payment reconciliation is disabled.' }, { status: 503 })
  try {
    const summary = await runRdsReconciliation()
    return Response.json(summary, { status: summary.ok ? 200 : 503 })
  } catch {
    console.error('F8 payment reconciliation failed.')
    return Response.json({ error: 'Payment reconciliation failed.' }, { status: 503 })
  }
}
