import 'server-only'

import { query } from '@/lib/db/query'

export async function findAnnouncementBarFromRds() {
  const section = await query<{ id: number; is_active: boolean; autoplay: boolean }>(
    'SELECT id, is_active, autoplay FROM public.support_announcement_bar WHERE section_key = $1 LIMIT 2',
    ['global_support_announcement_bar'], { operation: 'cms.announcement.section' },
  )
  if (section.rows.length > 1) throw new Error('Expected one announcement bar section.')
  const row = section.rows[0]
  if (!row) return null
  const items = await query<{ message: string; link_url: string | null; open_in_new_tab: boolean }>(
    'SELECT message, link_url, open_in_new_tab FROM public.support_announcement_bar_items WHERE bar_id = $1 AND is_active = true ORDER BY sort_order ASC',
    [row.id], { operation: 'cms.announcement.items' },
  )
  return { section: row, items: items.rows }
}

export async function findHipHopShowcaseFromRds() {
  const result = await query<Record<string, unknown>>('SELECT is_enabled, eyebrow, heading_line_1, heading_line_2, heading_emphasis, cta_label, cta_link, image_path, image_alt FROM public.hiphop_showcase_section WHERE section_key = $1 LIMIT 2', ['home_hiphop_showcase'], { operation: 'cms.hiphop_showcase' })
  if (result.rows.length > 1) throw new Error('Expected one hip-hop showcase section.')
  return result.rows[0] ?? null
}

export async function loadServiceBannerFromRds() {
  const [section, blocks] = await Promise.all([
    query<{ image_path: string | null; image_alt: string | null }>('SELECT image_path, image_alt FROM public.service_banner_section WHERE id = $1 AND is_enabled = true LIMIT 2', [1], { operation: 'cms.service_banner.section' }),
    query<Record<string, unknown>>('SELECT id, title, paragraph, sort_order FROM public.service_banner_blocks WHERE is_active = true ORDER BY sort_order ASC, created_at ASC', [], { operation: 'cms.service_banner.blocks' }),
  ])
  if (section.rows.length > 1) throw new Error('Expected one service banner section.')
  return { section: section.rows[0] ?? null, blocks: blocks.rows }
}

export async function findContactHeroFromRds() {
  const result = await query<Record<string, unknown>>('SELECT eyebrow, heading, subtitle FROM public.contact_hero WHERE section_key = $1 LIMIT 2', ['contact_hero'], { operation: 'cms.contact_hero' })
  if (result.rows.length > 1) throw new Error('Expected one contact hero row.')
  return result.rows[0] ?? null
}

export async function findPromotionPopupFromRds() {
  const section = await query<{ row: Record<string, unknown> }>(
    'SELECT to_jsonb(t) AS row FROM public.promotion_popup t WHERE section_key = $1 LIMIT 2',
    ['global_promotion_popup'], { operation: 'cms.promotion_popup' },
  )
  if (section.rows.length > 1) throw new Error('Expected one promotion popup section.')
  const row = section.rows[0]?.row
  if (!row) return null
  try {
    const questions = await query<Record<string, unknown>>(
      `SELECT id::int AS id, field_key, question, input_type, validation_pattern, validation_message,
              is_required, options, allow_multiple, sort_order
         FROM public.promotion_popup_questions WHERE promotion_id = $1 AND is_active = true ORDER BY sort_order ASC`,
      [row.id], { operation: 'cms.promotion_popup.questions' },
    )
    return { item: row, questions: questions.rows }
  } catch {
    // The existing public route serves its default email question if this
    // optional question list cannot be read.
    return { item: row, questions: [] }
  }
}

export async function findPromotionPopupOfferFromRds() {
  const result = await query<Record<string, unknown>>(
    `SELECT p.cta_action, p.selected_coupon_id, p.is_active AS promotion_is_active, p.description,
            c.discount_type, c.discount_value, c.reward_type, c.minimum_order_amount,
            c.is_active AS coupon_is_active, c.starts_at, c.ends_at, c.usage_limit, c.usage_count
       FROM public.promotion_popup p
       LEFT JOIN public.coupons c ON c.id = p.selected_coupon_id
      WHERE p.section_key = $1 LIMIT 2`,
    ['global_promotion_popup'], { operation: 'cms.promotion_popup.offer' },
  )
  if (result.rows.length > 1) throw new Error('Expected one promotion popup section.')
  return result.rows[0] ?? null
}

export async function loadActiveCouponBannerRowsFromRds(now: string, rewardType: string | null = null) {
  const result = await query<{ row: Record<string, unknown> }>(
    `SELECT jsonb_build_object(
       'id', c.id, 'code', c.code, 'title', c.title, 'reward_type', c.reward_type,
       'discount_value', c.discount_value, 'minimum_order_amount', c.minimum_order_amount,
       'gift_product_id', c.gift_product_id, 'gift_variant_data', c.gift_variant_data,
       'gift_banner_image_url', c.gift_banner_image_url, 'banner_title', c.banner_title,
       'banner_description', c.banner_description, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
       'featured_priority', c.featured_priority, 'usage_limit', c.usage_limit, 'usage_count', c.usage_count,
       'gift_product', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
         'id', p.id, 'name', p.name, 'slug', p.slug, 'sku', p.sku, 'status', p.status,
         'stock_quantity', p.stock_quantity, 'image_1_path', p.image_1_path) END) AS row
       FROM public.coupons c LEFT JOIN public.products p ON p.id = c.gift_product_id
      WHERE c.is_active = true AND c.banner_enabled = true
        AND (c.starts_at IS NULL OR c.starts_at <= $1)
        AND (c.ends_at IS NULL OR c.ends_at > $1)
        AND ($2::text IS NULL OR c.reward_type = $2)
      ORDER BY c.featured_priority DESC, c.created_at DESC`,
    [now, rewardType], { operation: 'cms.coupon_banners' },
  )
  return result.rows.map(({ row }) => row)
}
