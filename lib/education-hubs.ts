// Education hubs (for example /education/diamond-4cs) and the two-level article addresses under them.
// Pure rules only: no database, no framework, so the routing decisions can be tested on their own.

export type EducationHub = {
  id: number
  slug: string
  name: string
  introHtml: string | null
  pillarPostId: number | null
  seoTitle: string | null
  seoDescription: string | null
  seoH1: string | null
  seoIndexable: boolean
  sortOrder: number
}

type HubRow = Record<string, unknown>
type HubbedPost = { id?: number; slug?: string; hubId?: number | null; sortOrder?: number }

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)

export function mapEducationHubRow(row: HubRow): EducationHub {
  return {
    id: Number(row.id),
    slug: String(row.slug ?? ''),
    name: String(row.name ?? '').trim(),
    introHtml: text(row.intro_html),
    pillarPostId: row.pillar_post_id == null ? null : Number(row.pillar_post_id),
    seoTitle: text(row.seo_title),
    seoDescription: text(row.seo_description),
    seoH1: text(row.seo_h1),
    seoIndexable: row.seo_indexable !== false,
    sortOrder: Number(row.sort_order ?? 0) || 0,
  }
}

/** A hub or article address segment: lowercase words joined by single hyphens. */
export function isValidRouteSegment(value: string) {
  return value.length > 0 && value.length <= 300 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

export const educationHubPath = (hub: Pick<EducationHub, 'slug'>) => `/education/${hub.slug}`

function hubOfPost(post: HubbedPost, hubs: EducationHub[]) {
  return post.hubId == null ? null : hubs.find((hub) => hub.id === post.hubId) ?? null
}

/** Where an article lives: under its hub when that hub is published, otherwise directly under /education. */
export function educationPostPath(post: HubbedPost, hubs: EducationHub[]) {
  const hub = hubOfPost(post, hubs)
  if (!post.slug) return '/education'
  return hub ? `/education/${hub.slug}/${post.slug}` : `/education/${post.slug}`
}

export type EducationRouteDecision =
  | { kind: 'hub'; hub: EducationHub }
  | { kind: 'article' }
  | { kind: 'redirect'; to: string }
  | { kind: 'notFound' }

/** /education/<segment>: a hub page, an article, or an article that has moved under a hub. */
export function decideSingleSegment(segment: string, hubs: EducationHub[], post: HubbedPost | null): EducationRouteDecision {
  const hub = hubs.find((entry) => entry.slug === segment)
  if (hub) return { kind: 'hub', hub }
  if (!post) return { kind: 'notFound' }
  return hubOfPost(post, hubs) ? { kind: 'redirect', to: educationPostPath(post, hubs) } : { kind: 'article' }
}

/** /education/<hub>/<article>: renders only when the article really belongs to that published hub. */
export function decideTwoSegments(hubSegment: string, articleSegment: string, hubs: EducationHub[], post: HubbedPost | null): EducationRouteDecision {
  if (!post) return { kind: 'notFound' }
  const own = hubOfPost(post, hubs)
  if (own && own.slug === hubSegment) return { kind: 'article' }
  return { kind: 'redirect', to: educationPostPath(post, hubs) }
}

/** A hub's articles: the pillar first, then the editor's order. */
export function postsInHub<T extends HubbedPost>(posts: T[], hub: EducationHub): T[] {
  return posts
    .filter((post) => post.hubId === hub.id)
    .sort((a, b) => Number(b.id === hub.pillarPostId) - Number(a.id === hub.pillarPostId) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}
