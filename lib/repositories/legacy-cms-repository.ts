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

export async function loadDiamondInfoFeaturesFromRds() {
  return (await query<{ id: number; sort_order: number; icon_svg: string | null; title: string | null; description: string | null; is_active: boolean | null }>(
    `SELECT id, sort_order, icon_svg, title, description, is_active FROM public.diamond_info_feature_items
     WHERE section_key = $1 AND is_active = $2 ORDER BY sort_order ASC`,
    ['home_diamond_info', true], { operation: 'cms.diamond_info.features' },
  )).rows
}

export async function findDiamondInfoConfigFromRds() {
  const result = await query<{
    video_enabled: boolean | null; video_path: string | null; video_poster_path: string | null
    layout_mode: string | null; eyebrow: string | null; section_heading: string | null
    section_subtext: string | null; cta_label: string | null; cta_link: string | null
  }>(
    `SELECT video_enabled, video_path, video_poster_path, layout_mode, eyebrow,
      section_heading, section_subtext, cta_label, cta_link FROM public.diamond_info_config
     WHERE section_key = $1 LIMIT 2`, ['home_diamond_info'], { operation: 'cms.diamond_info.config' },
  )
  if (result.rows.length > 1) throw new Error('Expected one diamond information configuration.')
  return result.rows[0] ?? null
}
