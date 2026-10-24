import type { Metadata } from 'next'
import { createFixedPageMetadata } from '@/lib/page-seo'

export const dynamic = 'force-dynamic'
import EducationClient from '@/components/pages/EducationClient'
import { getEducationPageHero, getPublishedEducationSummaries } from '@/lib/education'

export function generateMetadata(): Promise<Metadata> {
  return createFixedPageMetadata('education', {
  title: 'Education',
  description: 'Learn about diamonds, jewelry, craftsmanship, care, and confident buying from House of Diams.',
  path: '/education',
})
}

export default async function EducationPage() {
  const [posts, hero] = await Promise.all([getPublishedEducationSummaries(), getEducationPageHero()])
  return <EducationClient posts={posts} hero={hero} />
}
