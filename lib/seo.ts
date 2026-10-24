import type { Metadata } from 'next'
import { getCanonicalUrl } from '@/lib/site-url'
import { limitDescription } from '@/lib/seo-description'

const defaultOgImage = '/logo.jpeg'

type PageSeoInput = {
  title: string
  description: string
  path: string
  image?: string | null
  type?: 'website' | 'article'
}

/** Blog and Education articles: editor SEO fields first, then the article's own title and intro. */
export function createArticleMetadata(
  post: { titleRaw: string; subtitle: string; seoTitle?: string; seoDescription?: string; seoIndexable?: boolean },
  path: string,
  image?: string | null
): Metadata {
  const metadata = createPageMetadata({
    title: post.seoTitle || post.titleRaw,
    description: post.seoDescription || post.subtitle,
    path,
    image,
    type: 'article',
  })
  return post.seoIndexable === false ? { ...metadata, robots: { index: false, follow: true } } : metadata
}

export function createPageMetadata({
  title,
  description,
  path,
  image = defaultOgImage,
  type = 'website',
}: PageSeoInput): Metadata {
  const canonical = getCanonicalUrl(path)
  description = limitDescription(description)
  const normalizedTitle = title.replace(/\s*\|\s*House of Diams\s*$/i, '').trim()
  const images = image ? [{ url: image, alt: `${normalizedTitle} - House of Diams` }] : undefined

  return {
    title: normalizedTitle,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: normalizedTitle,
      description,
      url: canonical,
      siteName: 'House of Diams',
      type,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: normalizedTitle,
      description,
      images: image ? [image] : undefined,
    },
  }
}
