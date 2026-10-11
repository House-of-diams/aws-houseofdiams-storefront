import { connection } from 'next/server'
import { mediaUrl } from '@/lib/media-url'
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

export async function getDocsPageContent(slug: string): Promise<DocsPageContent> {
  await connection()
  try {
    const page = await findDocsPageFromRds(slug)
    if (!page) return { page: null, blocks: [] }
    const blocks = await loadDocsBlocksFromRds(page.id)
    let faqCategory: DocsPageContent['faqCategory'] = null
    let faqItems: NonNullable<DocsPageContent['faqItems']> = []
    if (slug === 'returns' && page.faq_category_id) {
      const [category, items] = await Promise.all([
        findFaqCategoryFromRds(page.faq_category_id),
        loadFaqItemsByCategoryFromRds(page.faq_category_id),
      ])
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
