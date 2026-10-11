import 'server-only'

import { query } from '@/lib/db/query'
import { DatabaseError } from '@/lib/db/errors'

export async function findBespokeHeroFromRds() {
  try {
    const result = await query<Record<string, unknown>>(
      `SELECT id, badge_text, eyebrow, heading_line_1, heading_line_2, subtitle,
              primary_cta_label, primary_cta_action, secondary_cta_label,
              secondary_cta_action, slider_enabled, status, updated_at
         FROM public.bespoke_hero_content
        WHERE status = 'active'
        ORDER BY updated_at DESC LIMIT 1`, [], { operation: 'bespoke.hero' },
    )
    return { item: result.rows[0] ?? null, hasSliderColumn: true }
  } catch (error) {
    if (!(error instanceof DatabaseError) || error.code !== '42703') throw error
    const result = await query<Record<string, unknown>>(
      `SELECT id, badge_text, eyebrow, heading_line_1, heading_line_2, subtitle,
              primary_cta_label, primary_cta_action, secondary_cta_label,
              secondary_cta_action, status, updated_at
         FROM public.bespoke_hero_content
        WHERE status = 'active'
        ORDER BY updated_at DESC LIMIT 1`, [], { operation: 'bespoke.hero_legacy' },
    )
    return { item: result.rows[0] ?? null, hasSliderColumn: false }
  }
}

export async function loadBespokeHeroSlidesFromRds(heroId: string) {
  const result = await query<Record<string, unknown>>(
    `SELECT id, sort_order, image_path, mobile_image_path, button_text, button_link
       FROM public.bespoke_hero_slider_items WHERE hero_id = $1 ORDER BY sort_order ASC`,
    [heroId], { operation: 'bespoke.hero_slides' },
  )
  return result.rows
}

export async function loadBespokeProcessCardsFromRds() {
  const result = await query<Record<string, unknown>>(
    'SELECT id, sort_order, eyebrow, title, description FROM public.bespoke_process_cards ORDER BY sort_order ASC',
    [], { operation: 'bespoke.process_cards' },
  )
  return result.rows
}

export async function loadBespokeProcessStepsFromRds() {
  const result = await query<{
    id: number; sort_order: number; step: string | null; eyebrow: string | null; title: string | null;
    description: string | null; image_path: string | null; media_type: string | null; media_path: string | null;
  }>(
    `SELECT id::int AS id, sort_order, step, eyebrow, title, description, image_path, media_type, media_path
       FROM public.bespoke_process_steps ORDER BY sort_order ASC`,
    [], { operation: 'bespoke.process_steps' },
  )
  return result.rows
}

export async function loadBespokePortfolioFromRds() {
  const [categories, items] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT id, name, slug, image_path, display_order FROM public.bespoke_portfolio_categories
        WHERE status = 'active' ORDER BY display_order ASC`, [], { operation: 'bespoke.portfolio_categories' },
    ),
    query<Record<string, unknown>>(
      `SELECT id, title, tag, category_id, media_type, media_path, thumbnail_path,
              gem_style, gem_color, dark_theme, short_description, display_order
         FROM public.bespoke_portfolio_items WHERE status = 'active' ORDER BY display_order ASC`,
      [], { operation: 'bespoke.portfolio_items' },
    ),
  ])
  return { categories: categories.rows, items: items.rows }
}

export async function loadBespokeFormConfigFromRds() {
  const [settings, guarantees, pieceTypes, stoneOptions, caratOptions, metalOptions] = await Promise.all([
    query<{ row: Record<string, unknown> }>(
      `SELECT to_jsonb(t) AS row FROM public.bespoke_form_settings t WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1`,
      [], { operation: 'bespoke.form_settings' },
    ),
    ...(['guarantees', 'piece_types', 'stone_options', 'carat_options', 'metal_options'] as const).map((table) =>
      query<Record<string, unknown>>(
        `SELECT id, label, display_order FROM public.bespoke_form_${table}
          WHERE status = 'active' ORDER BY display_order ASC`, [], { operation: `bespoke.form_${table}` },
      ),
    ),
  ])
  return {
    settings: settings.rows[0]?.row ?? null,
    guarantees: guarantees.rows,
    pieceTypes: pieceTypes.rows,
    stoneOptions: stoneOptions.rows,
    caratOptions: caratOptions.rows,
    metalOptions: metalOptions.rows,
  }
}
