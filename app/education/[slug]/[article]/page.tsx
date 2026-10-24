import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import EducationArticleView from '@/components/pages/EducationArticleView'
import { getPublishedEducationHubs, getPublishedEducationPostBySlug, getPublishedEducationSummaries } from '@/lib/education'
import { decideTwoSegments, educationPostPath, isValidRouteSegment } from '@/lib/education-hubs'
import { createArticleMetadata, createPageMetadata } from '@/lib/seo'
import { getStorageImageUrl } from '@/lib/data/blog-posts'

// /education/<hub>/<article>: the first segment is named [slug] because it shares its folder with the single-level route.
type HubArticleProps = { params: Promise<{ slug: string; article: string }> }

export async function generateMetadata({ params }: HubArticleProps): Promise<Metadata> {
  const { slug: hubSegment, article: slug } = await params
  const notFoundMetadata = createPageMetadata({ title: 'Education Article Not Found', description: 'This educational article could not be found.', path: '/education', type: 'article' })
  if (!isValidRouteSegment(hubSegment) || !isValidRouteSegment(slug)) return notFoundMetadata
  const [hubs, post] = await Promise.all([getPublishedEducationHubs(), getPublishedEducationPostBySlug(slug)])
  if (!post || decideTwoSegments(hubSegment, slug, hubs, post).kind === 'notFound') return notFoundMetadata
  return createArticleMetadata(post, educationPostPath(post, hubs), getStorageImageUrl(post.heroImagePath))
}

export default async function EducationHubArticleRoute({ params }: HubArticleProps) {
  const { slug: hubSegment, article: slug } = await params
  if (!isValidRouteSegment(hubSegment) || !isValidRouteSegment(slug)) notFound()
  const [hubs, post, summaries] = await Promise.all([getPublishedEducationHubs(), getPublishedEducationPostBySlug(slug), getPublishedEducationSummaries()])
  const decision = decideTwoSegments(hubSegment, slug, hubs, post)
  if (decision.kind === 'notFound' || !post) notFound()
  if (decision.kind === 'redirect') permanentRedirect(decision.to)
  const hub = hubs.find((entry) => entry.id === post.hubId) ?? null
  return <EducationArticleView post={post} hub={hub} hubs={hubs} summaries={summaries} />
}
