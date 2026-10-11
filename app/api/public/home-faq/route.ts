import { NextResponse } from 'next/server'
import { loadHomepageFaqFromRds } from '@/lib/repositories/support-repository'

export const dynamic = 'force-dynamic'

async function readPublicContent() {
  return NextResponse.json({ data: await loadHomepageFaqFromRds() })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
