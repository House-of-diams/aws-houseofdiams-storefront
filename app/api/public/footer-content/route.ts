import { NextResponse } from 'next/server'
import { loadFooterCategoriesFromRds } from '@/lib/repositories/catalog-repository'
import { findCollectionPageConfigFromRds } from '@/lib/repositories/cms-repository'
import { cachePublicRead, publicCacheHeaders, PUBLIC_CACHE_LONG_SECONDS } from '@/lib/public-cache'

export const dynamic = 'force-dynamic'

const readFooterContent = cachePublicRead('footer-content', async () => {
  const [categories, collectionConfig] = await Promise.all([
    loadFooterCategoriesFromRds(),
    findCollectionPageConfigFromRds(),
  ])
  return { categories, collectionConfig: (collectionConfig ?? null) as Record<string, unknown> | null }
}, PUBLIC_CACHE_LONG_SECONDS)

async function readPublicContent() {
  return NextResponse.json(await readFooterContent(), { headers: publicCacheHeaders(PUBLIC_CACHE_LONG_SECONDS) })
}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
