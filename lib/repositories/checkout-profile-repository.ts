import 'server-only'
import { query } from '@/lib/db/query'

export type CheckoutProfile = {
  email?: string | null
  first_name: string | null; last_name: string | null; phone: string | null
  birth_date: string | null; anniversary_date: string | null
  country: string | null; state: string | null; district: string | null
  city: string | null; postal_code: string | null
  address_line_1: string | null; address_line_2: string | null
}
export async function loadCheckoutCustomerProfile(identityId: string) {
  return (await query<CheckoutProfile>(`select first_name, last_name, phone, birth_date::text, anniversary_date::text,
    country, state, district, city, postal_code, address_line_1, address_line_2
    from public.customer_profiles where identity_id = $1`, [identityId], { operation: 'checkout.profile.customer' })).rows[0] ?? null
}

export async function loadCheckoutDropdownGroups(productIds: string[]) {
  return (await query<{ id: string; product_id: string; name: string; label: string; is_required: boolean | null }>(`
    select id, product_id, name, label, is_required from public.product_custom_dropdowns
    where product_id = any($1::uuid[]) and is_enabled = true`, [productIds], { operation: 'checkout.prepare.dropdown-groups' })).rows
}

export async function loadCheckoutDropdownOptions(groupIds: string[]) {
  return (await query<{ id: string; dropdown_id: string; label: string; value: string; display_order: number | null }>(`
    select id, dropdown_id, label, value, display_order from public.product_custom_dropdown_options
    where dropdown_id = any($1::uuid[]) and is_enabled = true order by display_order asc`,
    [groupIds], { operation: 'checkout.prepare.dropdown-options' })).rows
}
