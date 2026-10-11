import { NextResponse } from 'next/server'
import { loadFooterCategoriesFromRds } from '@/lib/repositories/catalog-repository'
import { findCollectionPageConfigFromRds } from '@/lib/repositories/cms-repository'

export const dynamic = 'force-dynamic'

async function readPublicContent() {
  let categories: Array<{ id: string; name: string; slug: string }> = []
  let collectionConfig: Record<string, unknown> | null = null
  categories = await loadFooterCategoriesFromRds()
  collectionConfig = await findCollectionPageConfigFromRds()
  return NextResponse.json({ categories, collectionConfig })
}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
