import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import EducationArticleView from '@/components/pages/EducationArticleView'
import EducationHubPage from '@/components/pages/EducationHubPage'
import { getPublishedEducationHubs, getPublishedEducationPostBySlug, getPublishedEducationSummaries } from '@/lib/education'
import { decideSingleSegment, educationHubPath, educationPostPath, postsInHub } from '@/lib/education-hubs'
import { createArticleMetadata, createPageMetadata } from '@/lib/seo'
import { getStorageImageUrl } from '@/lib/data/blog-posts'

type EducationRouteProps = { params: Promise<{ slug: string }> }

const stripTags = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

export async function generateMetadata({ params }: EducationRouteProps): Promise<Metadata> {
  const { slug } = await params
  const [hubs, post] = await Promise.all([getPublishedEducationHubs(), getPublishedEducationPostBySlug(slug)])
  const decision = decideSingleSegment(slug, hubs, post)
  if (decision.kind === 'hub') {
    const { hub } = decision
    const metadata = createPageMetadata({
      title: hub.seoTitle || hub.name,
      description: hub.seoDescription || stripTags(hub.introHtml ?? '') || `Guides about ${hub.name} from House of Diams.`,
      path: educationHubPath(hub),
    })
    return hub.seoIndexable ? metadata : { ...metadata, robots: { index: false, follow: true } }
  }
  if (!post || decision.kind === 'notFound') {
    return createPageMetadata({ title: 'Education Article Not Found', description: 'This educational article could not be found.', path: '/education', type: 'article' })
  }
  return createArticleMetadata(post, educationPostPath(post, hubs), getStorageImageUrl(post.heroImagePath))
}

export default async function EducationPostRoute({ params }: EducationRouteProps) {
  const { slug } = await params
  // A hub, an article, or an article that now lives under a hub. A hub read failure throws (error page) instead of
  // answering with a wrong permanent redirect.
  const [hubs, post, summaries] = await Promise.all([getPublishedEducationHubs(), getPublishedEducationPostBySlug(slug), getPublishedEducationSummaries()])
  const decision = decideSingleSegment(slug, hubs, post)
  if (decision.kind === 'notFound') notFound()
  if (decision.kind === 'redirect') permanentRedirect(decision.to)
  if (decision.kind === 'hub') return <EducationHubPage hub={decision.hub} posts={postsInHub(summaries, decision.hub)} />
  if (!post) notFound()
  return <EducationArticleView post={post} hub={null} hubs={hubs} summaries={summaries} />
}
