import { NextResponse } from 'next/server'
import { getStorefrontProductSearchItems } from '@/lib/catalog-products'

// Results are the same for every visitor, so CloudFront and browsers may share them.
const QUERY_CACHE_CONTROL = 'public, max-age=60, s-maxage=60, stale-while-revalidate=120'
const DEFAULT_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=60'

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams.get('q')?.trim().slice(0, 80) ?? ''
    return NextResponse.json(
      { items: await getStorefrontProductSearchItems(query, query ? 12 : 16) },
      { headers: { 'Cache-Control': query ? QUERY_CACHE_CONTROL : DEFAULT_CACHE_CONTROL } }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load product search.' },
      { status: 500 }
    )
  }
}
