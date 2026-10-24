import 'server-only'

import { query } from '@/lib/db/query'

type EditorialRow = Record<string, unknown>

async function rows<T = EditorialRow>(sql: string, values: readonly unknown[], operation: string) {
  const result = await query<{ row: T }>(sql, values, { operation })
  return result.rows.map(({ row }) => row)
}

/**
 * HOD-061: lists read summaries (no body, content blocks or product links);
 * a post page reads its one post by slug. Only these two fixed query shapes exist.
 */
export type EditorialPostQuery = { summary: true } | { slug: string }

const blockColumns = `jsonb_build_object('id', b.id, 'block_type', b.block_type, 'sort_order', b.sort_order,
        'heading', b.heading, 'body_html', b.body_html, 'image_path', b.image_path, 'image_alt', b.image_alt,
        'image_caption', b.image_caption, 'is_enabled', b.is_enabled)`

export async function loadPublishedBlogRowsFromRds(options: EditorialPostQuery) {
  const summary = 'summary' in options
  return rows(`SELECT ${summary ? `(to_jsonb(p) - 'body_html')` : 'to_jsonb(p)'} || jsonb_build_object(
      'catalog_category', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug) END,
      'blog_post_tags', COALESCE((SELECT jsonb_agg(jsonb_build_object('tag', t.tag, 'sort_order', t.sort_order) ORDER BY t.sort_order) FROM public.blog_post_tags t WHERE t.post_id = p.id), '[]'::jsonb),
      'blog_post_content_blocks', ${summary ? `'[]'::jsonb` : `COALESCE((SELECT jsonb_agg(${blockColumns} ORDER BY b.sort_order)
        FROM public.blog_post_content_blocks b WHERE b.post_id = p.id), '[]'::jsonb)`},
      'blog_post_products', ${summary ? `'[]'::jsonb` : `COALESCE((SELECT jsonb_agg(jsonb_build_object('product_id', x.product_id, 'sort_order', x.sort_order) ORDER BY x.sort_order)
        FROM public.blog_post_products x WHERE x.post_id = p.id), '[]'::jsonb)`}) AS row
      FROM public.blog_posts p
      LEFT JOIN public.catalog_categories c ON c.id = p.catalog_category_id
      WHERE p.is_published = $1 ${summary ? '' : 'AND p.slug = $2'} ORDER BY p.sort_order ASC, p.id ASC`,
    summary ? [true] : [true, options.slug], summary ? 'editorial.blog.summaries' : 'editorial.blog.by-slug')
}

export async function loadPublishedEducationRowsFromRds(options: EditorialPostQuery) {
  const summary = 'summary' in options
  return rows(`SELECT ${summary ? `(to_jsonb(p) - 'body_html')` : 'to_jsonb(p)'} || jsonb_build_object(
      'education_post_tags', COALESCE((SELECT jsonb_agg(jsonb_build_object('tag', t.tag, 'sort_order', t.sort_order) ORDER BY t.sort_order)
        FROM public.education_post_tags t WHERE t.post_id = p.id), '[]'::jsonb),
      'education_post_content_blocks', ${summary ? `'[]'::jsonb` : `COALESCE((SELECT jsonb_agg(${blockColumns} ORDER BY b.sort_order)
        FROM public.education_post_content_blocks b WHERE b.post_id = p.id), '[]'::jsonb)`},
      'education_post_products', ${summary ? `'[]'::jsonb` : `COALESCE((SELECT jsonb_agg(jsonb_build_object('product_id', x.product_id, 'sort_order', x.sort_order) ORDER BY x.sort_order)
        FROM public.education_post_products x WHERE x.post_id = p.id), '[]'::jsonb)`}) AS row
      FROM public.education_posts p WHERE p.is_published = $1 ${summary ? '' : 'AND p.slug = $2'} ORDER BY p.sort_order ASC`,
    summary ? [true] : [true, options.slug], summary ? 'editorial.education.summaries' : 'editorial.education.by-slug')
}

/** Published education hubs. Before the hubs table exists (file 11) there are simply none. */
export async function loadPublishedEducationHubsFromRds() {
  try {
    return await rows(`SELECT to_jsonb(h) AS row FROM public.education_hubs h WHERE h.is_published ORDER BY h.sort_order ASC, h.id ASC`, [], 'editorial.education.hubs')
  } catch (error) {
    if ((error as { code?: string })?.code === '42P01') return []
    throw error
  }
}

export async function findEditorialHeroFromRds(kind: 'blog' | 'education') {
  const result = kind === 'blog'
    ? await rows<{ is_enabled: boolean; heading: string | null; paragraph: string | null; button_label: string | null; button_link: string | null; desktop_image_path: string | null; mobile_image_path: string | null; desktop_image_alt: string | null; mobile_image_alt: string | null }>('SELECT to_jsonb(t) AS row FROM public.blog_page_hero t WHERE id = $1 LIMIT 2', [1], 'editorial.blog.hero')
    : await rows<{ is_enabled: boolean; heading: string | null; paragraph: string | null; button_label: string | null; button_link: string | null; desktop_image_path: string | null; mobile_image_path: string | null; desktop_image_alt: string | null; mobile_image_alt: string | null }>('SELECT to_jsonb(t) AS row FROM public.education_page_hero t WHERE id = $1 LIMIT 2', [1], 'editorial.education.hero')
  if (result.length > 1) throw new Error(`Expected one ${kind} page hero.`)
  return result[0] ?? null
}

export async function loadLiveBlogCategoriesFromRds() {
  return rows('SELECT jsonb_build_object(\'id\', id, \'name\', name, \'slug\', slug) AS row FROM public.catalog_categories WHERE status = $1 AND slug <> $2 ORDER BY display_order ASC', ['active', 'hiphop'], 'editorial.blog.categories')
}
