import 'server-only'

import { query } from '@/lib/db/query'

export async function findAdditionalSummaryFromRds() {
  const section = await query<{ id: string; heading: string }>(
    `SELECT id, heading FROM public.cms_summary_sections
      WHERE section_key = $1 AND is_enabled = true LIMIT 2`,
    ['additional_summary_details'], { operation: 'cms.summary_section' },
  )
  if (section.rows.length > 1) throw new Error('Expected one summary section.')
  const row = section.rows[0]
  if (!row) return null
  const pointers = await query<Record<string, unknown>>(
    `SELECT id, icon_url, pointer_text, video_url, video_link_text
       FROM public.cms_summary_pointers WHERE section_id = $1
      ORDER BY sort_order ASC, created_at ASC`,
    [row.id], { operation: 'cms.summary_pointers' },
  )
  return pointers.rows.length ? { heading: row.heading, pointers: pointers.rows } : null
}
