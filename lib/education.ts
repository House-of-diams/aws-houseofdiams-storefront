import { mapBlogPostRecord, getStorageImageUrl, type BlogPost } from '@/lib/data/blog-posts'
import type { BlogPageHero } from '@/lib/blog'
import { getStorefrontProductsByIds } from '@/lib/catalog-products'
import { findEditorialHeroFromRds, loadPublishedEducationRowsFromRds } from '@/lib/repositories/editorial-repository'
import { unstable_cache } from 'next/cache'
import { cachePublicRead, PUBLIC_CACHE_LONG_SECONDS, PUBLIC_CONTENT_TAG } from '@/lib/public-cache'

const getCachedEducationHeroRow = cachePublicRead('education-page-hero', () => findEditorialHeroFromRds('education'), PUBLIC_CACHE_LONG_SECONDS)

type EducationPostRow = {
  id: number
  slug: string
  category: string
  author: string
  date_label: string
  read_time: string
  bg_key: string
  bg_color: string
  title: string
  title_html: string
  subtitle: string
  body_html: string
  hero_image_path: string
  card_title?: string | null
  card_image_path?: string | null
  hero_image_alt: string | null
  is_published: boolean
  sort_order: number
  created_at?: string | null
  updated_at?: string | null
  seo_title?: string | null
  seo_description?: string | null
  seo_indexable?: boolean | null
  published_at?: string | null
  hub_id?: number | null
  education_post_tags: Array<{ tag: string; sort_order: number }> | null
  education_post_content_blocks: Array<{
    id: number
    block_type: 'text' | 'image' | 'heading' | 'quote'
    sort_order: number
    heading: string | null
    body_html: string | null
    image_path: string | null
    image_alt: string | null
    image_caption: string | null
    is_enabled: boolean
  }> | null
  education_post_products: Array<{ product_id: string; sort_order: number }> | null
}

function mapRow(row: EducationPostRow): BlogPost {
  return mapBlogPostRecord({
    ...row,
    // Summaries carry no body (HOD-061).
    body_html: row.body_html ?? '',
    hero_image_alt: row.hero_image_alt ?? undefined,
    content_blocks: (row.education_post_content_blocks ?? [])
      .filter((block) => block.is_enabled !== false)
      .sort((a, b) => a.sort_order - b.sort_order),
    tags: (row.education_post_tags ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((tag) => tag.tag),
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  })
}

// HOD-061: lists use light summaries; a post page loads its one post by slug.
const getCachedEducationSummaries = unstable_cache(
  async () => ((await loadPublishedEducationRowsFromRds({ summary: true })) as unknown as EducationPostRow[]).map(mapRow),
  ['education-published-summaries-v2'],
  { revalidate: PUBLIC_CACHE_LONG_SECONDS, tags: [PUBLIC_CONTENT_TAG] }
)

export async function getPublishedEducationSummaries(): Promise<BlogPost[]> {
  return getCachedEducationSummaries()
}

// One full post per cache entry; it embeds featured products, so refresh with them.
async function loadEducationPostBySlug(slug: string): Promise<BlogPost | null> {
  const row = ((await loadPublishedEducationRowsFromRds({ slug })) as unknown as EducationPostRow[])[0]
  if (!row) return null
  const entries = (row.education_post_products ?? []).sort((a, b) => a.sort_order - b.sort_order)
  const productMap = new Map((await getStorefrontProductsByIds(entries.map((entry) => entry.product_id))).map((product) => [product.dbId, product]))
  const featuredProducts = entries
    .map((entry) => productMap.get(entry.product_id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product))
  return { ...mapRow(row), featuredProducts }
}

const getCachedEducationPostBySlug = unstable_cache(
  (slug: string) => loadEducationPostBySlug(slug),
  ['education-post-by-slug-v1'],
  { revalidate: PUBLIC_CACHE_LONG_SECONDS, tags: [PUBLIC_CONTENT_TAG, 'storefront-products'] }
)

export async function getPublishedEducationPostBySlug(slug: string) {
  if (!slug || slug.length > 300) return null
  return getCachedEducationPostBySlug(slug)
}

export async function getEducationPageHero(): Promise<BlogPageHero | null> {

  const { data, error } = { data: await getCachedEducationHeroRow(), error: null as { code?: string; message: string } | null }
  if (error || !data || data.is_enabled === false) return null
  return {
    isEnabled: true,
    heading: data.heading ?? 'Education',
    paragraph: data.paragraph ?? '',
    buttonLabel: data.button_label ?? '',
    buttonLink: data.button_link ?? '',
    desktopImageUrl: getStorageImageUrl(data.desktop_image_path ?? ''),
    desktopImageAlt: data.desktop_image_alt ?? data.heading ?? 'Education',
    mobileImageUrl: getStorageImageUrl(data.mobile_image_path ?? data.desktop_image_path ?? ''),
    mobileImageAlt: data.mobile_image_alt ?? data.desktop_image_alt ?? data.heading ?? 'Education',
  }
}
