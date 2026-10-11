import type { Metadata } from 'next'
import DocsPage from '@/components/docs/DocsPage'
import ReturnsFaqPage, { type ReturnsContactRow } from '@/components/docs/ReturnsFaqPage'
import JsonLd from '@/components/seo/JsonLd'
import { createFaqSchema } from '@/lib/structured-data'
import { createPageMetadata } from '@/lib/seo'
import { getDocsPageContent } from '@/lib/docs-pages'
import { loadContactInfoFromRds } from '@/lib/repositories/support-repository'

export const metadata: Metadata = createPageMetadata({
  title: 'Returns',
  description: 'Returns and exchange information from House of Diams.',
  path: '/returns',
})

const fallbackContactRows: ReturnsContactRow[] = [
  { id: 'fallback-email', label: 'Email', value: 'info@houseofdiams.com', note: null, href: 'mailto:info@houseofdiams.com', icon_path: null },
  { id: 'fallback-phone', label: 'Phone & WhatsApp', value: '+91 93285 36178', note: null, href: 'tel:+919328536178', icon_path: null },
  { id: 'fallback-address', label: 'Address', value: '36 W 44th Street, Suite 1000B, New York, 10036, USA', note: null, href: null, icon_path: null },
]

async function getContactRows(): Promise<ReturnsContactRow[]> {
  try {

    const { data, error } = { data: await loadContactInfoFromRds(), error: null as { code?: string; message: string } | null }

    if (error) return fallbackContactRows

    const rows = (data ?? [])
      .filter((row) => row.label && row.value)
      .map((row) => ({
        id: row.id,
        label: row.label,
        value: row.value,
        note: row.note ?? null,
        href: row.href ?? null,
        icon_path: row.icon_path ?? null,
      }))

    return rows.length ? rows : fallbackContactRows
  } catch {
    return fallbackContactRows
  }
}

export default async function ReturnsPage() {
  const { page, blocks, faqCategory, faqItems } = await getDocsPageContent('returns')
  const contactRows = await getContactRows()

  if (faqCategory) {
    return <>
      {(faqItems?.length ?? 0) > 0 ? <JsonLd data={createFaqSchema((faqItems ?? []).map(({ question, answer }) => ({ question, answer })))} /> : null}
      <ReturnsFaqPage
        title={faqCategory.name || page?.title || 'Returns & Exchanges'}
        items={faqItems ?? []}
        contactRows={contactRows}
      />
    </>
  }

  return <DocsPage eyebrow={page?.eyebrow ?? 'Support'} title={page?.title ?? 'Returns'} subtitle={page?.subtitle ?? 'Returns and exchange information.'} blocks={blocks.length ? blocks : [{ heading: 'Returns', description: 'Returns, exchanges, and claim information.', body: 'If something needs attention, contact us and we will guide you through the next steps.' }]} />
}
