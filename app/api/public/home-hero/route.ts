import { NextResponse } from 'next/server'
import { getFreshHomeHeroContent } from '@/lib/home-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ content: await getFreshHomeHeroContent() })
}
