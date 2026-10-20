import { NextResponse } from 'next/server'
import { getStorefrontProductsByIdentifiers } from '@/lib/catalog-products'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const slugs = Array.isArray(body?.slugs) ? body.slugs.filter((value: unknown): value is string => typeof value === 'string').slice(0, 50) : []
  const ids = Array.isArray(body?.ids) ? body.ids.filter((value: unknown): value is string => typeof value === 'string').slice(0, 50) : []
  if (!slugs.length && !ids.length) return NextResponse.json({ items: [] })
  try {
    const products = await getStorefrontProductsByIdentifiers({ slugs, ids, limit: 50 })
    return NextResponse.json({ items: products.map((product) => ({ id: String(product.id), dbId: product.dbId, slug: product.slug, name: product.name, shortMeta: product.shortMeta, imageUrl: product.imageUrl || '', priceFrom: product.priceFrom, mainCategorySlug: product.mainCategorySlug, mainCategoryName: product.mainCategoryName })) })
  } catch (error) {
    // HOD-034: never send internal error text to the browser.
    console.error('Cart products lookup failed:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ error: 'Unable to load cart products.' }, { status: 500 })
  }
}
