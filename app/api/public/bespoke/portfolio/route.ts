import { NextResponse } from 'next/server'
import { loadBespokePortfolioFromRds } from '@/lib/repositories/bespoke-repository'
import { mediaUrl } from '@/lib/media-url'

export const dynamic = 'force-static'
export const revalidate = 300

type PortfolioCategory = {
  id: string
  name: string
  slug: string
  image_path: string | null
  display_order: number
}

type PortfolioItem = {
  id: string
  title: string
  tag: string
  category_id: string
  media_type: 'image' | 'video'
  media_path: string | null
  thumbnail_path: string | null
  gem_style: string | null
  gem_color: string | null
  dark_theme: boolean
  short_description: string | null
  display_order: number
}

function buildPublicUrl(path: string | null) {
  return mediaUrl(path)
}

async function readPublicContent() {
  const result = await loadBespokePortfolioFromRds()
  const categories = result.categories as PortfolioCategory[]
  const portfolioItems = result.items as PortfolioItem[]

  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  const items = portfolioItems
    .map((item) => ({
      ...item,
      category: categoryMap.get(item.category_id) ?? null,
      media_url: buildPublicUrl(item.media_path),
      thumbnail_url: buildPublicUrl(item.thumbnail_path),
    }))
    .filter((item) => item.category)

  return NextResponse.json({
    categories,
    items,
  })
}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
