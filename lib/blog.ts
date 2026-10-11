import { mapBlogPostRecord, posts as fallbackPosts, type BlogPost } from '@/lib/data/blog-posts'
import { getStorefrontProductsByIds } from '@/lib/catalog-products'
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
  blog_post_tags: BlogTagRow[] | null
  blog_post_content_blocks: BlogContentBlockRow[] | null
  blog_post_products: { product_id: string; sort_order: number | null }[] | null
}

async function loadPublishedBlogRows() {
  return loadPublishedBlogRowsFromRds() as unknown as BlogPostRow[]

}

function mapRows(rows: BlogPostRow[] | null): BlogPost[] {
  return ((rows?.length ? rows : null)?.map((row) =>
    mapBlogPostRecord({
      ...row,
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
  ) ?? fallbackPosts).filter((post) => post.isPublished !== false)
}

export async function getPublishedBlogPosts() {
  const rows = await loadPublishedBlogRows()
  const mappedPosts = mapRows(rows)
  if (!rows?.length) return mappedPosts

  const storefrontProducts = await getStorefrontProductsByIds(
    rows.flatMap((row) => (row.blog_post_products ?? []).map((entry) => entry.product_id))
  )
  const productMap = new Map(storefrontProducts.map((product) => [product.dbId, product]))

  return mappedPosts.map((post) => {
    const sourceRow = rows.find((row) => row.id === post.id)
    const featuredProducts = (sourceRow?.blog_post_products ?? [])
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((entry) => productMap.get(entry.product_id))
      .filter((product): product is NonNullable<typeof product> => Boolean(product))

    return { ...post, featuredProducts }
  })
}

export async function getPublishedBlogPostBySlug(slug: string) {
  const posts = await getPublishedBlogPosts()
  return posts.find((post) => post.slug === slug) ?? null
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

  const { data, error } = { data: await findEditorialHeroFromRds('blog'), error: null as { code?: string; message: string } | null }

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
  const data = await loadLiveBlogCategoriesFromRds() as unknown as BlogFilterCategory[]
  return data.filter((category) => category.id && category.name && category.slug)

}
