import { NextResponse } from 'next/server'
import { loadHomepageFaqFromRds } from '@/lib/repositories/support-repository'
import { cachePublicRead, publicCacheHeaders, PUBLIC_CACHE_LONG_SECONDS } from '@/lib/public-cache'

export const dynamic = 'force-dynamic'

const readHomepageFaq = cachePublicRead('home-faq', loadHomepageFaqFromRds, PUBLIC_CACHE_LONG_SECONDS)

async function readPublicContent() {
  return NextResponse.json({ data: await readHomepageFaq() }, { headers: publicCacheHeaders(PUBLIC_CACHE_LONG_SECONDS) })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
