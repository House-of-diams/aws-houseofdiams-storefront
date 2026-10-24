import 'server-only'

import { getPublishedBlogSummaries } from '@/lib/blog'
import { getPublishedEducationSummaries } from '@/lib/education'
import type { CatalogSeoFields } from '@/lib/repositories/catalog-repository'
import { sanitizePageCopy } from '@/lib/sanitize-html'

export type CatalogGuideLink = { href: string; title: string }

/** The SEO copy a category page shows, taken from the most specific record (option, then subcategory, then category). */
export type CatalogSeoCopy = {
  heading: string | null
  introHtml: string | null
  bodyHtml: string | null
  guide: CatalogGuideLink | null
}

function cleanHtml(value: string | null) {
  const html = value?.trim() ? sanitizePageCopy(value).trim() : ''
  return html || null
}

// A guide link is shown only when it points at a published Blog or Education
// article, so the anchor can use that article's real title.
async function resolveGuideLink(path: string | null): Promise<CatalogGuideLink | null> {
  const match = path?.trim().match(/^\/(blog|education)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/)
  if (!match) return null
  const [, section, slug] = match
  const posts = section === 'blog' ? await getPublishedBlogSummaries() : await getPublishedEducationSummaries()
  const post = posts.find((entry) => entry.slug === slug)
  return post ? { href: `/${section}/${slug}`, title: post.titleRaw || post.title } : null
}

export async function getCatalogSeoCopy(record: CatalogSeoFields): Promise<CatalogSeoCopy> {
  return {
    heading: record.seo_h1?.trim() || null,
    introHtml: cleanHtml(record.seo_intro_html),
    bodyHtml: cleanHtml(record.seo_body_html),
    guide: await resolveGuideLink(record.seo_guide_path).catch(() => null),
  }
}
