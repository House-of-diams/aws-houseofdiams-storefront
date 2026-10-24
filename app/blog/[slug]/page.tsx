import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BlogPostPage from '@/components/pages/BlogPostPage'
import { getPublishedBlogPostBySlug, getPublishedBlogSummaries } from '@/lib/blog'
import { createArticleMetadata, createPageMetadata } from '@/lib/seo'
import { getStorageImageUrl } from '@/lib/data/blog-posts'
import JsonLd from '@/components/seo/JsonLd'
import { createBlogPostingSchema, createBreadcrumbSchema, createFaqSchema } from '@/lib/structured-data'
import { extractBlogFaqItems } from '@/lib/blog-faq'

type BlogPostRouteProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: BlogPostRouteProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getPublishedBlogPostBySlug(slug)

  if (!post) {
    return createPageMetadata({
      title: 'Blog Post Not Found',
      description: 'This House of Diams journal article could not be found.',
      path: '/blog',
      type: 'article',
    })
  }

  return createArticleMetadata(post, `/blog/${post.slug}`, getStorageImageUrl(post.heroImagePath))
}

export default async function BlogPostRoute({ params }: BlogPostRouteProps) {
  const { slug } = await params
  // HOD-061: this post in full; related cards from the light summaries.
  const [post, summaries] = await Promise.all([getPublishedBlogPostBySlug(slug), getPublishedBlogSummaries()])

  if (!post) {
    notFound()
  }

  const relatedPosts = summaries.filter((entry) => entry.id !== post.id).slice(0, 3)
  const faqItems = extractBlogFaqItems(post)

  return (
    <>
      <JsonLd data={createBlogPostingSchema(post, getStorageImageUrl(post.heroImagePath))} />
      <JsonLd data={createBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Blog', path: '/blog' },
        { name: post.titleRaw, path: `/blog/${post.slug}` },
      ])} />
      {faqItems.length ? <JsonLd data={createFaqSchema(faqItems)} /> : null}
      <BlogPostPage post={post} relatedPosts={relatedPosts} />
    </>
  )
}
