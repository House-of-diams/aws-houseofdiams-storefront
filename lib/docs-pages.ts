import { connection } from 'next/server'
import { unstable_cache } from 'next/cache'
import { mediaUrl } from '@/lib/media-url'
import { PUBLIC_CACHE_LONG_SECONDS, PUBLIC_CONTENT_TAG } from '@/lib/public-cache'
import {
  findDocsPageFromRds,
  findFaqCategoryFromRds,
  loadDocsBlocksFromRds,
  loadFaqItemsByCategoryFromRds,
} from '@/lib/repositories/support-repository'

export type DocsPageContent = {
  page: { eyebrow: string; title: string; subtitle: string } | null
  blocks: Array<{ heading: string; description: string; body: string }>
  faqCategory?: { id: number; name: string; description: string; imageUrl: string; imageAlt: string } | null
  faqItems?: Array<{ id: number; question: string; answer: string; sort_order: number }>
}

// Raw reads are cached per slug (errors are not), so the empty fallback
// returned by getDocsPageContent on failure is never stored.
const getCachedDocsRows = unstable_cache(
  async (slug: string) => {
    const page = await findDocsPageFromRds(slug)
    if (!page) return null
    const [blocks, category, items] = await Promise.all([
      loadDocsBlocksFromRds(page.id),
      slug === 'returns' && page.faq_category_id ? findFaqCategoryFromRds(page.faq_category_id) : Promise.resolve(null),
      slug === 'returns' && page.faq_category_id ? loadFaqItemsByCategoryFromRds(page.faq_category_id) : Promise.resolve([]),
    ])
    return { page, blocks, category, items }
  },
  ['docs-page-rows-v1'],
  { revalidate: PUBLIC_CACHE_LONG_SECONDS, tags: [PUBLIC_CONTENT_TAG] }
)

export async function getDocsPageContent(slug: string): Promise<DocsPageContent> {
  await connection()
  try {
    const rows = await getCachedDocsRows(slug)
    if (!rows) return { page: null, blocks: [] }
    const { page, blocks } = rows
    let faqCategory: DocsPageContent['faqCategory'] = null
    let faqItems: NonNullable<DocsPageContent['faqItems']> = []
    if (slug === 'returns' && page.faq_category_id) {
      const { category, items } = rows
      if (category) {

        const imageUrl = mediaUrl(category.image_path)
        faqCategory = { id: category.id, name: category.name, description: category.description ?? '', imageUrl, imageAlt: category.image_alt || category.name }
      }
      faqItems = items
    }
    return { page: { eyebrow: page.eyebrow, title: page.title, subtitle: page.subtitle }, blocks, faqCategory, faqItems }
  } catch (error) {
    console.error(`Unable to load Docs page "${slug}".`, error)
    return { page: null, blocks: [] }
  }

}
