import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
import EducationClient from '@/components/pages/EducationClient'
import { getEducationPageHero, getPublishedEducationSummaries } from '@/lib/education'
import { createPageMetadata } from '@/lib/seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Education',
  description: 'Learn about diamonds, jewellery, craftsmanship, care, and confident buying from House of Diams.',
  path: '/education',
})

export default async function EducationPage() {
  const [posts, hero] = await Promise.all([getPublishedEducationSummaries(), getEducationPageHero()])
  return <EducationClient posts={posts} hero={hero} />
}
