import type { StorefrontProduct } from '@/lib/catalog-products'
import type { BlogPost } from '@/lib/data/blog-posts'
import { mediaUrl } from '@/lib/media-url'
import { getCanonicalUrl, getSiteUrl } from '@/lib/site-url'

type FaqSchemaItem = {
  question: string
  answer: string
}

type OrganizationSettings = {
  org_name?: string | null
  org_logo_path?: string | null
  org_same_as?: string[] | null
}

export function createOrganizationSchema(settings?: OrganizationSettings | null) {
  const siteUrl = getSiteUrl()
  const sameAs = (settings?.org_same_as ?? []).map((url) => url.trim()).filter((url) => /^https:\/\//i.test(url))

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: settings?.org_name?.trim() || 'House of Diams',
    url: siteUrl,
    logo: mediaUrl(settings?.org_logo_path) || getCanonicalUrl('/logo.jpeg').toString(),
    ...(sameAs.length ? { sameAs } : {}),
    contactPoint: [
      {
        '@type': 'ContactPoint',
        email: 'info@houseofdiams.com',
        telephone: '+91 93285 36178',
        contactType: 'customer support',
        availableLanguage: ['English', 'Hindi'],
      },
    ],
    address: [
      {
        '@type': 'PostalAddress',
        addressLocality: 'Surat',
        addressRegion: 'Gujarat',
        addressCountry: 'IN',
      },
      {
        '@type': 'PostalAddress',
        addressLocality: 'New York',
        addressRegion: 'NY',
        addressCountry: 'US',
      },
    ],
  }
}

export function createBreadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: getCanonicalUrl(item.path).toString(),
    })),
  }
}

export function createProductSchema(product: StorefrontProduct) {
  const imageUrls = [product.imageUrl, ...(product.galleryUrls ?? [])].filter(Boolean)
  const price = Number(product.priceFrom)

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.descriptionText || product.shortMeta,
    sku: product.sku || product.dbId,
    category: product.mainCategoryName || product.category,
    brand: {
      '@type': 'Brand',
      name: 'House of Diams',
    },
    image: imageUrls,
    url: getCanonicalUrl(`/shop/${product.slug}`).toString(),
    material: product.metalsFull.map((metal) => metal.displayLabel || metal.name).filter(Boolean),
    offers: Number.isFinite(price) && price > 0
      ? {
          '@type': 'Offer',
          price,
          priceCurrency: 'USD',
          // Pieces are made to order, so stock does not decide availability; a piece
          // that can be checked out is orderable now (HOD-076). Enquiry-only pieces
          // (collection lane, hip hop without checkout) are not offered as in stock.
          availability: product.productLane === 'standard' || (product.productLane === 'hiphop' && product.allowCheckout)
            ? 'https://schema.org/InStock'
            : 'https://schema.org/LimitedAvailability',
          url: getCanonicalUrl(`/shop/${product.slug}`).toString(),
          seller: {
            '@type': 'Organization',
            name: 'House of Diams',
          },
        }
      : undefined,
  }
}

export function createFaqSchema(items: FaqSchemaItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

function toIsoDate(value: string | undefined) {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

export function createBlogPostingSchema(
  post: BlogPost,
  imageUrl?: string | null,
  canonicalPath = `/blog/${post.slug ?? ''}`
) {
  // published_at is the first publish; older posts only have created_at.
  const datePublished = toIsoDate(post.publishedAt) ?? toIsoDate(post.createdAt)
  const dateModified = toIsoDate(post.updatedAt) ?? datePublished
  // Brand bylines ("House of Diams", "HOD Team", ...) are the organization, not a person.
  const authorName = post.author?.trim() || 'House of Diams'
  const isBrandAuthor = /^(house of diams|hod)\b/i.test(authorName) && !authorName.includes(',')

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.titleRaw || post.title,
    description: post.subtitle,
    image: imageUrl ? [imageUrl] : undefined,
    datePublished,
    dateModified,
    author: isBrandAuthor
      ? { '@type': 'Organization', name: 'House of Diams', url: getSiteUrl() }
      : { '@type': 'Person', name: authorName },
    publisher: {
      '@type': 'Organization',
      name: 'House of Diams',
      logo: {
        '@type': 'ImageObject',
        url: getCanonicalUrl('/logo.jpeg').toString(),
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': getCanonicalUrl(canonicalPath).toString(),
    },
  }
}
