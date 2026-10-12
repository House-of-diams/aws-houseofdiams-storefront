import type { Metadata } from 'next'
import JsonLd from '@/components/seo/JsonLd'
import FaqClient from '@/components/pages/FaqClient'
import { createPageMetadata } from '@/lib/seo'
import { createFaqSchema } from '@/lib/structured-data'
import { findFaqSectionFromRds, loadFaqCategoriesFromRds, loadFaqItemsFromRds } from '@/lib/repositories/support-repository'
import { cachePublicRead, PUBLIC_CACHE_LONG_SECONDS } from '@/lib/public-cache'

export const metadata: Metadata = createPageMetadata({
  title: 'FAQ',
  description: 'Frequently asked questions about House of Diams orders, diamonds, shipping, and support.',
  path: '/faq',
})

const fallbackFaqs = [
  {
    question: "What's the difference between natural and lab-grown diamonds?",
    answer:
      'Both are real diamonds. Natural diamonds form over billions of years beneath the earth, while lab-grown diamonds are created in controlled conditions. They are chemically, physically and optically identical. The key difference is origin and pricing.',
    category_id: null,
  },
  {
    question: 'Do your diamonds come with certification?',
    answer:
      'Every diamond comes with certification details based on the selected stone. We also provide a House of Diams certificate of authenticity with each order.',
    category_id: null,
  },
  {
    question: 'Do you ship internationally?',
    answer:
      'Yes. We ship worldwide with secure, tracked, and insured delivery. Customs and duties may vary by country.',
    category_id: null,
  },
]

type FaqCategory = {
  id: number
  name: string
  image_path: string | null
  image_alt: string | null
}

// Raw reads are cached (errors are not), so the fallback below is never stored.
const getCachedFaqRows = cachePublicRead('faq-page-rows', async () => {
  const [section, categories] = await Promise.all([findFaqSectionFromRds(), loadFaqCategoriesFromRds()])
  const items = section?.id ? await loadFaqItemsFromRds(section.id) : null
  return { section: section ?? null, categories, items }
}, PUBLIC_CACHE_LONG_SECONDS)

async function getFaqContent() {
  try {
    const faqRows = await getCachedFaqRows()

    const { data: sectionData } = { data: faqRows.section }

    const { data: categoryData } = { data: faqRows.categories }

    let items: Array<{ question: string; answer: string; category_id: number | null }> = fallbackFaqs
    if (sectionData?.id) {
      const { data: itemData } = { data: faqRows.items }

      const parsed = (itemData ?? [])
        .filter((item) => item.question && item.answer)
        .map((item) => ({ question: item.question, answer: item.answer, category_id: item.category_id ?? null }))
      if (parsed.length) items = parsed
    }

    return {
      title: sectionData?.title || '',
      subtitle: sectionData?.subtitle || '',
      categories: (categoryData ?? []) as FaqCategory[],
      items,
    }
  } catch {
    return { title: '', subtitle: '', categories: [] as FaqCategory[], items: fallbackFaqs }
  }
}

export default async function FaqPage() {
  const { title, subtitle, categories, items } = await getFaqContent()

  return (
    <main className="min-h-screen bg-(--color-white) px-4 pb-16 pt-12 sm:px-7 sm:pb-24 sm:pt-16">
      <JsonLd data={createFaqSchema(items)} />
      <FaqClient title={title} subtitle={subtitle} categories={categories} items={items} />
    </main>
  )
}
