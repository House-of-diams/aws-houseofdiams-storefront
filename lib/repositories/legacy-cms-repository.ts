import 'server-only'
import { query } from '@/lib/db/query'

export type HipHopHeroRow = {
  id: number; eyebrow: string | null; headline: string | null; subtitle: string | null
  slider_enabled: boolean | null; is_active: boolean
}
export type HipHopHeroSlideRow = {
  id: number; sort_order: number; image_path: string; mobile_image_path: string | null
  button_text: string; button_link: string
}

export async function findHipHopHeroFromRds() {
  const result = await query<HipHopHeroRow>(
    'SELECT * FROM public.hiphop_hero_content WHERE section_key = $1 AND is_active = $2 LIMIT 2',
    ['hiphop_hero', true], { operation: 'cms.hiphop.hero' },
  )
  if (result.rows.length > 1) throw new Error('Expected one Hip Hop hero.')
  return result.rows[0] ?? null
}

export async function loadHipHopHeroSlidesFromRds(heroId: number) {
  return (await query<HipHopHeroSlideRow>(
    `SELECT id, sort_order, image_path, mobile_image_path, button_text, button_link
     FROM public.hiphop_hero_slider_items WHERE hero_id = $1 ORDER BY sort_order ASC`,
    [heroId], { operation: 'cms.hiphop.hero_slides' },
  )).rows
}

export async function loadCategoryFaqFromRds(categoryId: string) {
  return (await query<{ id: number; question: string; answer: string; sort_order: number }>(
    `SELECT id, question, answer, sort_order FROM public.support_faq_items
     WHERE catalog_category_id = $1 AND is_active = $2 ORDER BY sort_order ASC`,
    [categoryId, true], { operation: 'support.faq.category' },
  )).rows
}

