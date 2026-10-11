import 'server-only'

import { query } from '@/lib/db/query'

export type FaqSection = { id: number; title: string | null; subtitle: string | null }
export type FaqCategory = { id: number; name: string; description: string | null; image_path: string | null; image_alt: string | null }
export type FaqItem = { id: number; question: string; answer: string; category_id: number | null; sort_order: number }

export async function findFaqSectionFromRds() {
  const result = await query<FaqSection>('SELECT id::int AS id, title, subtitle FROM public.support_faq_section WHERE section_key = $1 LIMIT 2', ['global_support_faq'], { operation: 'support.faq.section' })
  if (result.rows.length > 1) throw new Error('Expected one FAQ section.')
  return result.rows[0] ?? null
}

export async function loadFaqCategoriesFromRds() {
  const result = await query<FaqCategory>('SELECT id::int AS id, name, description, image_path, image_alt FROM public.support_faq_categories WHERE is_active = $1 ORDER BY sort_order ASC', [true], { operation: 'support.faq.categories' })
  return result.rows
}

export async function loadFaqItemsFromRds(sectionId: number) {
  const result = await query<FaqItem>('SELECT id::int AS id, question, answer, category_id::int AS category_id, sort_order FROM public.support_faq_items WHERE section_id = $1 AND is_active = $2 ORDER BY sort_order ASC', [sectionId, true], { operation: 'support.faq.items' })
  return result.rows
}

export async function loadHomepageFaqFromRds() {
  const section = await findFaqSectionFromRds()
  if (!section) return null
  const items = await query<{ id: number; sort_order: number; question: string; answer: string; is_active: boolean }>(
    'SELECT id::int AS id, sort_order, question, answer, is_active FROM public.support_faq_items WHERE section_id = $1 AND is_active = true ORDER BY sort_order ASC',
    [section.id], { operation: 'support.faq.homepage_items' },
  )
  return { section, items: items.rows }
}

export async function loadFaqItemsByCategoryFromRds(categoryId: number) {
  const result = await query<FaqItem>('SELECT id::int AS id, question, answer, category_id::int AS category_id, sort_order FROM public.support_faq_items WHERE category_id = $1 AND is_active = $2 ORDER BY sort_order ASC', [categoryId, true], { operation: 'support.faq.items_by_category' })
  return result.rows
}

export async function findFaqCategoryFromRds(id: number) {
  const result = await query<FaqCategory>('SELECT id::int AS id, name, description, image_path, image_alt FROM public.support_faq_categories WHERE id = $1 AND is_active = $2 LIMIT 2', [id, true], { operation: 'support.faq.category' })
  if (result.rows.length > 1) throw new Error('Expected one FAQ category.')
  return result.rows[0] ?? null
}

export type DocsPageRow = { id: number; eyebrow: string; title: string; subtitle: string; faq_category_id: number | null }
export type DocsBlockRow = { heading: string; description: string; body: string }

export async function findDocsPageFromRds(slug: string) {
  const result = await query<DocsPageRow>('SELECT id::int AS id, eyebrow, title, subtitle, faq_category_id::int AS faq_category_id FROM public.docs_pages WHERE slug = $1 LIMIT 1', [slug], { operation: 'support.docs.page' })
  return result.rows[0] ?? null
}

export async function loadDocsBlocksFromRds(pageId: number) {
  const result = await query<DocsBlockRow>('SELECT heading, description, body FROM public.docs_blocks WHERE page_id = $1 ORDER BY sort_order ASC', [pageId], { operation: 'support.docs.blocks' })
  return result.rows
}

export type ContactInfoRow = { id: string; sort_order: number; label: string; value: string; note: string | null; href: string | null; icon_path: string | null }

export async function loadContactInfoFromRds() {
  const result = await query<ContactInfoRow>('SELECT id, sort_order, label, value, note, href, icon_path FROM public.contact_info ORDER BY sort_order ASC', [], { operation: 'support.contact.info' })
  return result.rows
}
