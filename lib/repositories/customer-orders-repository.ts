import 'server-only'
import { query } from '@/lib/db/query'
import type { F7CheckoutOwner } from '@/lib/f7-checkout-owner'

export async function listCustomerOrders(owner: Extract<F7CheckoutOwner, { kind: 'customer' }>, page: number, pageSize: number) {
  const [orders, count] = await Promise.all([
    query<{ id: string; [key: string]: unknown }>(`select id, order_number, status, payment_status,
      subtotal_amount, gst_amount, shipping_amount, total_amount, customer_email, customer_first_name,
      customer_last_name, customer_phone, customer_birth_date::text, customer_anniversary_date::text, shipping_country,
      shipping_state, shipping_district, shipping_city, shipping_postal_code, shipping_address_line_1,
      shipping_address_line_2, payment_gateway, razorpay_payment_method, created_at
      from public.orders where customer_identity_id = $1 and user_id is null and guest_token_hash is null
      order by created_at desc limit $2 offset $3`, [owner.id, pageSize, (page - 1) * pageSize],
      { operation: 'customer.orders-list' }),
    query<{ total: string }>(`select count(*) total from public.orders where customer_identity_id = $1
      and user_id is null and guest_token_hash is null`, [owner.id], { operation: 'customer.orders-count' }),
  ])
  const items = orders.rows.length ? (await query<{ order_id: string; [key: string]: unknown }>(`
    select i.order_id, i.product_name, i.quantity, i.unit_price, i.line_total, i.image_url,
      i.selected_metal, i.selected_purity, i.selected_size_or_fit, i.selected_gemstone, i.selected_carat, i.item_type
    from public.order_items i join public.orders o on o.id = i.order_id
    where o.id = any($1::uuid[]) and o.customer_identity_id = $2 and o.user_id is null and o.guest_token_hash is null`,
    [orders.rows.map((order) => order.id), owner.id], { operation: 'customer.orders-items' })).rows : []
  return { orders: orders.rows.map((order) => ({ ...order,
    subtotal_amount: order.subtotal_amount == null ? null : Number(order.subtotal_amount),
    gst_amount: order.gst_amount == null ? null : Number(order.gst_amount),
    shipping_amount: order.shipping_amount == null ? null : Number(order.shipping_amount),
    total_amount: order.total_amount == null ? null : Number(order.total_amount),
    items: items.filter((item) => item.order_id === order.id).map((item) => ({ ...item,
      unit_price: item.unit_price == null ? null : Number(item.unit_price),
      line_total: item.line_total == null ? null : Number(item.line_total),
    })) })),
    total: Number(count.rows[0]?.total || 0) }
}
