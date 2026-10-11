import 'server-only'
import { query } from '@/lib/db/query'

type ResultPage = { main_banner_image_path: string | null; main_banner_image_alt: string | null;
  secondary_banner_image_path: string | null; secondary_banner_image_alt: string | null;
  secondary_eyebrow: string | null; secondary_heading: string | null; secondary_paragraph: string | null; is_enabled: boolean }

export async function loadCheckoutResultContent(state: string) {
  const results = await Promise.allSettled([
    query<ResultPage>(`select main_banner_image_path, main_banner_image_alt, secondary_banner_image_path,
      secondary_banner_image_alt, secondary_eyebrow, secondary_heading, secondary_paragraph, is_enabled
      from public.checkout_result_page where id = 1 and is_enabled = true`, [], { operation: 'checkout.result-page' }),
    query(`select state, eyebrow, heading, paragraph, order_button_label, is_enabled from public.checkout_result_states
      where state = $1 and is_enabled = true`, [state], { operation: 'checkout.result-state' }),
    query('select id, sort_order, label, value, note, href, icon_path from public.contact_info order by sort_order', [],
      { operation: 'checkout.result-contact' }),
    query(`select name, slug, display_order from public.catalog_categories where status = 'active'
      order by display_order limit 3`, [], { operation: 'checkout.result-categories' }),
  ])
  const [page, resultState, contact, categories] = results
  for (const result of results) if (result.status === 'rejected') console.warn('F7 checkout result content unavailable.')
  return { page: page.status === 'fulfilled' ? page.value.rows[0] ?? null : null,
    state: resultState.status === 'fulfilled' ? resultState.value.rows[0] ?? null : null,
    contact: contact.status === 'fulfilled' ? contact.value.rows : [],
    categories: categories.status === 'fulfilled' ? categories.value.rows : [] }
}
