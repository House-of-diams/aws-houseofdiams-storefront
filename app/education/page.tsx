import type { Metadata } from 'next'
import { createFixedPageMetadata } from '@/lib/page-seo'

export const dynamic = 'force-dynamic'
import EducationClient from '@/components/pages/EducationClient'
import { getEducationPageHero, getPublishedEducationHubs, getPublishedEducationSummaries } from '@/lib/education'
import { educationPostPath } from '@/lib/education-hubs'

export function generateMetadata(): Promise<Metadata> {
  return createFixedPageMetadata('education', {
  title: 'Education',
  description: 'Learn about diamonds, jewelry, craftsmanship, care, and confident buying from House of Diams.',
  path: '/education',
})
}

export default async function EducationPage() {
  const [summaries, hero, hubs] = await Promise.all([getPublishedEducationSummaries(), getEducationPageHero(), getPublishedEducationHubs()])
  const posts = summaries.map((post) => ({ ...post, href: educationPostPath(post, hubs) }))
  return <EducationClient posts={posts} hero={hero} />
}
