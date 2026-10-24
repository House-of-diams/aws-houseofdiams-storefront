import { mapBlogPostRecord, posts as fallbackPosts, type BlogPost } from '@/lib/data/blog-posts'
import { unstable_cache } from 'next/cache'
import { getStorefrontProductsByIds } from '@/lib/catalog-products'
import { cachePublicRead, PUBLIC_CACHE_LONG_SECONDS, PUBLIC_CONTENT_TAG } from '@/lib/public-cache'
import {
  findEditorialHeroFromRds,
  loadLiveBlogCategoriesFromRds,
  loadPublishedBlogRowsFromRds,
} from '@/lib/repositories/editorial-repository'

type BlogTagRow = { tag: string; sort_order: number | null }
type BlogContentBlockRow = {
  id: number
  block_type: 'text' | 'image' | 'heading' | 'quote'
  sort_order: number | null
  heading: string | null
  body_html: string | null
  image_path: string | null
  image_alt: string | null
  image_caption: string | null
  is_enabled: boolean | null
}
type BlogPostRow = {
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
  hero_image_path: string | null
  card_title?: string | null
  card_image_path?: string | null
  hero_image_alt?: string | null
  is_published: boolean
  sort_order: number | null
  created_at: string | null
  updated_at: string | null
  catalog_category_id: string | null
  catalog_category: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null
  seo_title?: string | null
  seo_description?: string | null
  seo_indexable?: boolean | null
  published_at?: string | null
  blog_post_tags: BlogTagRow[] | null
  blog_post_content_blocks: BlogContentBlockRow[] | null
  blog_post_products: { product_id: string; sort_order: number | null }[] | null
}

function mapRows(rows: BlogPostRow[]): BlogPost[] {
  return rows.map((row) =>
    mapBlogPostRecord({
      ...row,
      // Summaries carry no body (HOD-061).
      body_html: row.body_html ?? '',
      hero_image_path: row.hero_image_path ?? undefined,
      hero_image_alt: row.hero_image_alt ?? undefined,
      content_blocks: (row.blog_post_content_blocks ?? [])
        .filter((block) => block.is_enabled !== false)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      sort_order: row.sort_order ?? undefined,
      created_at: row.created_at ?? undefined,
      updated_at: row.updated_at ?? undefined,
      catalog_category_id: row.catalog_category_id,
      catalog_category: row.catalog_category,
      tags: (row.blog_post_tags ?? [])
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((tag) => tag.tag),
    })
  ).filter((post) => post.isPublished !== false)
}

// HOD-061: lists (blog page, related posts, sitemap) use light summaries: no
// bodies, content blocks or product cards. Built-in sample posts show only
// while the database has no published posts, as before.
async function loadBlogSummaries(): Promise<{ posts: BlogPost[]; fromDatabase: boolean }> {
  const rows = await loadPublishedBlogRowsFromRds({ summary: true }) as unknown as BlogPostRow[]
  return rows.length ? { posts: mapRows(rows), fromDatabase: true } : { posts: fallbackPosts.filter((post) => post.isPublished !== false), fromDatabase: false }
}

const getCachedBlogSummaries = unstable_cache(
  () => loadBlogSummaries(),
  ['blog-published-summaries-v2'],
  { revalidate: PUBLIC_CACHE_LONG_SECONDS, tags: [PUBLIC_CONTENT_TAG] }
)

export async function getPublishedBlogSummaries() {
  return (await getCachedBlogSummaries()).posts
}

// One full post per cache entry. Posts embed featured product cards, so refresh
// with product changes too.
async function loadBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const rows = await loadPublishedBlogRowsFromRds({ slug }) as unknown as BlogPostRow[]
  const row = rows[0]
  if (!row) {
    const summaries = await getCachedBlogSummaries()
    return summaries.fromDatabase ? null : summaries.posts.find((post) => post.slug === slug) ?? null
  }
  const [post] = mapRows([row])
  if (!post) return null
  const entries = (row.blog_post_products ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const productMap = new Map((await getStorefrontProductsByIds(entries.map((entry) => entry.product_id))).map((product) => [product.dbId, product]))
  const featuredProducts = entries
    .map((entry) => productMap.get(entry.product_id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product))
  return { ...post, featuredProducts }
}

const getCachedBlogPostBySlug = unstable_cache(
  (slug: string) => loadBlogPostBySlug(slug),
  ['blog-post-by-slug-v1'],
  { revalidate: PUBLIC_CACHE_LONG_SECONDS, tags: [PUBLIC_CONTENT_TAG, 'storefront-products'] }
)

const getCachedBlogHeroRow = cachePublicRead('blog-page-hero', () => findEditorialHeroFromRds('blog'), PUBLIC_CACHE_LONG_SECONDS)
const getCachedLiveBlogCategories = cachePublicRead('blog-live-categories', () => loadLiveBlogCategoriesFromRds(), PUBLIC_CACHE_LONG_SECONDS)

export async function getPublishedBlogPostBySlug(slug: string) {
  if (!slug || slug.length > 300) return null
  return getCachedBlogPostBySlug(slug)
}

export type BlogPageHero = {
  isEnabled: boolean
  heading: string
  paragraph: string
  buttonLabel: string
  buttonLink: string
  desktopImageUrl: string
  desktopImageAlt: string
  mobileImageUrl: string
  mobileImageAlt: string
}

export async function getBlogPageHero(): Promise<BlogPageHero | null> {

  const { data, error } = { data: await getCachedBlogHeroRow(), error: null as { code?: string; message: string } | null }

  if (error || !data || data.is_enabled === false) return null
  const { getStorageImageUrl } = await import('@/lib/data/blog-posts')
  return {
    isEnabled: true,
    heading: data.heading ?? '',
    paragraph: data.paragraph ?? '',
    buttonLabel: data.button_label ?? '',
    buttonLink: data.button_link ?? '',
    desktopImageUrl: getStorageImageUrl(data.desktop_image_path ?? ''),
    desktopImageAlt: data.desktop_image_alt ?? data.heading ?? '',
    mobileImageUrl: getStorageImageUrl(data.mobile_image_path ?? data.desktop_image_path ?? ''),
    mobileImageAlt: data.mobile_image_alt ?? data.desktop_image_alt ?? data.heading ?? '',
  }
}

export type BlogFilterCategory = { id: string; name: string; slug: string }

export async function getLiveBlogCategories(): Promise<BlogFilterCategory[]> {
  const data = await getCachedLiveBlogCategories() as unknown as BlogFilterCategory[]
  return data.filter((category) => category.id && category.name && category.slug)

}
