import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import EducationPostPage from '@/components/pages/EducationPostPage'
import { getPublishedEducationPostBySlug, getPublishedEducationSummaries } from '@/lib/education'
import { createArticleMetadata, createPageMetadata } from '@/lib/seo'
import { getStorageImageUrl } from '@/lib/data/blog-posts'
import JsonLd from '@/components/seo/JsonLd'
import { createBlogPostingSchema, createBreadcrumbSchema } from '@/lib/structured-data'

type EducationRouteProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: EducationRouteProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getPublishedEducationPostBySlug(slug)
  if (!post) {
    return createPageMetadata({ title: 'Education Article Not Found', description: 'This educational article could not be found.', path: '/education', type: 'article' })
  }
  return createArticleMetadata(post, `/education/${post.slug}`, getStorageImageUrl(post.heroImagePath))
}

export default async function EducationPostRoute({ params }: EducationRouteProps) {
  const { slug } = await params
  // HOD-061: this post in full; related cards from the light summaries.
  const [post, summaries] = await Promise.all([getPublishedEducationPostBySlug(slug), getPublishedEducationSummaries()])
  if (!post) notFound()
  const relatedPosts = summaries.filter((entry) => entry.id !== post.id).slice(0, 3)
  return (
    <>
      <JsonLd data={createBlogPostingSchema(post, getStorageImageUrl(post.heroImagePath), `/education/${post.slug}`)} />
      <JsonLd data={createBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Education', path: '/education' },
        { name: post.titleRaw, path: `/education/${post.slug}` },
      ])} />
      <EducationPostPage post={post} relatedPosts={relatedPosts} />
    </>
  )
}
