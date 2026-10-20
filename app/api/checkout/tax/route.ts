import { NextResponse } from 'next/server'
import { loadCheckoutTaxFromRds } from '@/lib/repositories/checkout-tax-repository'

const MAX_BATCH_SLUGS = 50

type TaxInfo = {
  gstLabel: string
  gstPercentage: number
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ gstLabel: 'Taxes', gstPercentage: 0 })
  }

  try {
    const taxBySlug = await loadCheckoutTaxFromRds([slug])
    // HOD-030: an unknown product is a 404, not an empty 200 body.
    if (!taxBySlug[slug]) return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
    return NextResponse.json(taxBySlug[slug])
  } catch {
    return NextResponse.json({ error: 'Unable to load checkout tax.' }, { status: 503 })
  }

}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { slugs?: unknown } | null
  if (!Array.isArray(body?.slugs) || body.slugs.length === 0 || body.slugs.length > MAX_BATCH_SLUGS) {
    return NextResponse.json({ error: `Provide between 1 and ${MAX_BATCH_SLUGS} product slugs.` }, { status: 400 })
  }

  if (body.slugs.some((slug) => typeof slug !== 'string' || !slug.trim() || slug.length > 200)) {
    return NextResponse.json({ error: 'Every product slug must be a non-empty string.' }, { status: 400 })
  }

  const slugs = [...new Set(body.slugs.map((slug) => (slug as string).trim()))]
  try {
    return NextResponse.json({ taxBySlug: await loadCheckoutTaxFromRds(slugs) })
  } catch {
    return NextResponse.json({ error: 'Unable to load checkout tax.' }, { status: 503 })
  }

}
