import 'server-only'

import { query } from '@/lib/db/query'

type AboutHeroRow = {
  is_enabled: boolean; media_type: 'image' | 'video'; desktop_media_path: string | null; mobile_media_path: string | null;
  video_poster_path: string | null; media_alt: string | null; show_text_overlay: boolean; heading: string | null; paragraph: string | null;
  show_button: boolean; button_label: string | null; button_link: string | null; overlay_position: 'left' | 'center' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right'; overlay_scrim_enabled: boolean;
}
type AboutBannerRow = {
  is_enabled: boolean; desktop_image_path: string | null; mobile_image_path: string | null; image_alt: string | null;
  heading: string | null; paragraph: string | null; show_button: boolean; button_label: string | null; button_link: string | null;
  content_position: 'left' | 'center' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right'; sort_order: number;
}
type AboutFounderRow = { sort_order: number; name: string; designation: string; bio: string; image_path: string | null }
type AboutTimelineRow = { id: number; sort_order: number; year: string; label: string }
type AboutValueRow = { sort_order: number; icon_path: string | null; image_path: string | null; image_alt: string | null; title?: string; description?: string }

async function rows<T>(sql: string, values: readonly unknown[], operation: string) {
  const result = await query<{ row: T }>(sql, values, { operation })
  return result.rows.map(({ row }) => row)
}

async function one<T>(sql: string, values: readonly unknown[], operation: string) {
  const data = await rows<T>(sql, values, operation)
  if (data.length > 1) throw new Error(`Expected one row for ${operation}.`)
  return data[0] ?? null
}

export async function findAboutHeroFromRds() {
  return one<AboutHeroRow>(`SELECT to_jsonb(t) AS row FROM (
    SELECT is_enabled, media_type, desktop_media_path, mobile_media_path,
           video_poster_path, media_alt, show_text_overlay, heading, paragraph,
           show_button, button_label, button_link, overlay_position, overlay_scrim_enabled
      FROM public.about_hero WHERE section_key = $1 LIMIT 2
  ) t`, ['about_hero'], 'about.hero')
}

export async function findAboutWideBannerFromRds() {
  return one<AboutBannerRow>(`SELECT to_jsonb(t) AS row FROM (
    SELECT is_enabled, desktop_image_path, mobile_image_path, image_alt, heading,
           paragraph, show_button, button_label, button_link, content_position, sort_order
      FROM public.about_wide_banner WHERE section_key = $1 LIMIT 2
  ) t`, ['about_wide_banner'], 'about.wide_banner')
}

export async function loadAboutFoundersFromRds() {
  return rows<AboutFounderRow>(`SELECT to_jsonb(t) AS row FROM (
    SELECT sort_order, name, designation, bio, image_path
      FROM public.about_founders ORDER BY sort_order ASC
  ) t ORDER BY t.sort_order ASC`, [], 'about.founders')
}

export async function loadAboutTimelineFromRds() {
  return rows<AboutTimelineRow>(`SELECT to_jsonb(t) AS row FROM (
    SELECT id, sort_order, year, label
      FROM public.about_timeline ORDER BY sort_order ASC
  ) t ORDER BY t.sort_order ASC`, [], 'about.timeline')
}

export async function loadAboutValuesFromRds() {
  return rows<AboutValueRow>(`SELECT to_jsonb(t) AS row FROM (
    SELECT id, sort_order, icon_path, image_path, image_alt, title, description
      FROM public.about_values ORDER BY sort_order ASC
  ) t ORDER BY t.sort_order ASC`, [], 'about.values')
}

export async function loadAboutPageRowsFromRds() {
  const [hero, banner, founders, timeline, values] = await Promise.all([
    findAboutHeroFromRds(), findAboutWideBannerFromRds(), loadAboutFoundersFromRds(),
    loadAboutTimelineFromRds(), loadAboutValuesFromRds(),
  ])
  return [
    { data: hero, error: null as { code?: string; message: string } | null }, { data: banner, error: null as { code?: string; message: string } | null },
    { data: founders, error: null as { code?: string; message: string } | null }, { data: timeline, error: null as { code?: string; message: string } | null },
    { data: values, error: null as { code?: string; message: string } | null },
  ] as const
}
