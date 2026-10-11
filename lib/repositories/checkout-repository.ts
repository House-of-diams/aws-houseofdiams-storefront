import 'server-only'
import { query } from '@/lib/db/query'
import { withTransaction } from '@/lib/db/transaction'
import { requireF7WritePrepared } from '@/lib/f7-write-prepared'
import type { F7CheckoutOwner } from '@/lib/f7-checkout-owner'

export const orderResultColumns = `id, order_number, created_at, customer_email, customer_first_name,
  customer_last_name, customer_phone, customer_birth_date::text, customer_anniversary_date::text,
  shipping_country, shipping_state, shipping_district, shipping_city, shipping_postal_code,
  shipping_address_line_1, shipping_address_line_2, subtotal_amount, gst_amount, shipping_amount,
  total_amount, status, payment_status, payment_gateway, payment_currency, payment_amount,
  razorpay_order_id, razorpay_payment_id, razorpay_payment_method, gateway_order_status,
  gateway_payment_status, gateway_payload`

export type CheckoutOrder = {
  id: string; order_number: string; created_at: string; customer_email: string | null
  customer_first_name: string | null; customer_last_name: string | null; customer_phone: string | null
  subtotal_amount: string | number; gst_amount: string | number; shipping_amount: string | number
  total_amount: string | number; payment_amount: string | number; payment_currency: string | null
  status: string; payment_status: string; payment_gateway: string | null
  razorpay_order_id: string | null; razorpay_payment_id: string | null; razorpay_payment_method: string | null
  gateway_order_status: string | null; gateway_payment_status: string | null
  gateway_payload: { checkout?: { coupon?: { code?: string; discountAmount?: number } }; totals?: Record<string, unknown> } | null
}

function normalizeOrder(order: CheckoutOrder | undefined) {
  if (!order) return null
  return { ...order, subtotal_amount: Number(order.subtotal_amount), gst_amount: Number(order.gst_amount),
    shipping_amount: Number(order.shipping_amount), total_amount: Number(order.total_amount),
    payment_amount: order.payment_amount == null ? null : Number(order.payment_amount) }
}

export function ownerValues(owner: F7CheckoutOwner) {
  return [owner.kind === 'customer' ? owner.id : null, owner.kind === 'guest' ? owner.hash : null]
}

export async function createRdsPendingOrder(input: { order: Record<string, unknown>;
  items: Array<Record<string, unknown>>; loveLetter: Record<string, unknown> | null;
  birthDate: string | null; anniversaryDate: string | null }) {
  requireF7WritePrepared()
  const result = await query<{ order: { id: string; order_number: string; customer_email: string | null;
    customer_first_name: string | null; customer_last_name: string | null;
    total_amount: number | null; created_at: string | null } }>(`
    select public.create_pending_order_v2($1::uuid, $2::jsonb, $3::jsonb,
      $4::jsonb, $5::date, $6::date) as "order"`,
    [null, JSON.stringify(input.order), JSON.stringify(input.items),
      input.loveLetter ? JSON.stringify(input.loveLetter) : null, input.birthDate, input.anniversaryDate],
    { operation: 'checkout.create-pending-order' })
  return result.rows[0]?.order ?? null
}

// Fixed predicates: no caller-controlled SQL identifiers or ownership columns.
export async function findOwnedOrder(owner: F7CheckoutOwner, reference: { id?: string; number?: string }) {
  const result = await query<CheckoutOrder>(`select ${orderResultColumns} from public.orders
    where (($1::uuid is not null and id = $1) or ($2::text is not null and order_number = $2))
      and user_id is null and ((customer_identity_id = $3::uuid and guest_token_hash is null)
        or (guest_token_hash = $4::text and customer_identity_id is null)) limit 1`,
    [reference.id ?? null, reference.number ?? null, ...ownerValues(owner)], { operation: 'checkout.owned-order' })
  return normalizeOrder(result.rows[0])
}

export async function findGatewayOrder(razorpayOrderId: string) {
  const result = await query<CheckoutOrder>(`select ${orderResultColumns} from public.orders
    where razorpay_order_id = $1 and payment_gateway = 'razorpay' limit 1`, [razorpayOrderId],
    { operation: 'checkout.gateway-order' })
  return normalizeOrder(result.rows[0])
}

export async function cancelOwnedOrder(owner: F7CheckoutOwner, orderId: string) {
  requireF7WritePrepared()
  return withTransaction(async (client) => {
    const locked = await client.query<{ fulfillment_mode: string }>(`select fulfillment_mode from public.orders
      where id = $1 and payment_status = 'pending' and user_id is null
        and ((customer_identity_id = $2::uuid and guest_token_hash is null)
          or (guest_token_hash = $3::text and customer_identity_id is null)) for update`,
      [orderId, ...ownerValues(owner)])
    if (!locked.rowCount) return false
    if (owner.kind === 'guest') {
      const result = await client.query<{ cancelled: boolean }>(
        'select public.cancel_pending_guest_checkout($1::uuid, $2::text) as cancelled', [orderId, owner.hash])
      return result.rows[0]?.cancelled === true
    }
    // Customer orders have no legacy auth.users owner. Keep the row locked
    // across the existing release function and dismissal update.
    if (locked.rows[0].fulfillment_mode !== 'made_to_order') throw new Error('Unexpected customer fulfillment mode.')
    await client.query('select public.release_order_inventory_reservation($1::uuid)', [orderId])
    const updated = await client.query(`update public.orders set gateway_order_status = 'checkout_dismissed'
      where id = $1 and customer_identity_id = $2 and payment_status = 'pending'`, [orderId, owner.id])
    return updated.rowCount === 1
  })
}

export async function listOrderItems(owner: F7CheckoutOwner, orderId: string) {
  return (await query<{ product_name: string; product_slug: string; quantity: number; unit_price: string;
    line_total: string; image_url: string | null; selected_metal: string | null; selected_purity: string | null;
    selected_size_or_fit: string | null; selected_gemstone: string | null; selected_carat: string | null; item_type: string }>(`
    select i.product_name, i.product_slug, i.quantity, i.unit_price, i.line_total, i.image_url,
      i.selected_metal, i.selected_purity, i.selected_size_or_fit, i.selected_gemstone, i.selected_carat, i.item_type
    from public.order_items i join public.orders o on o.id = i.order_id where o.id = $1 and o.user_id is null
      and ((o.customer_identity_id = $2::uuid and o.guest_token_hash is null)
        or (o.guest_token_hash = $3::text and o.customer_identity_id is null)) order by i.created_at asc`,
    [orderId, ...ownerValues(owner)], { operation: 'checkout.owned-items' })).rows.map((item) => ({
      ...item, unit_price: Number(item.unit_price), line_total: Number(item.line_total),
    }))
}

export async function listOrderHistory(owner: F7CheckoutOwner, orderId: string) {
  return (await query<{ status: string; created_at: string }>(`select h.status, h.created_at
    from public.order_status_history h join public.orders o on o.id = h.order_id where o.id = $1 and o.user_id is null
      and ((o.customer_identity_id = $2::uuid and o.guest_token_hash is null)
        or (o.guest_token_hash = $3::text and o.customer_identity_id is null)) order by h.created_at, h.id`,
    [orderId, ...ownerValues(owner)], { operation: 'checkout.owned-history' })).rows
}
