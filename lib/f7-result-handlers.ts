import 'server-only'
import { f7Json } from '@/lib/f7-checkout-handlers'
import { resolveF7CheckoutOwner } from '@/lib/f7-checkout-owner'
import { requireF7WritePrepared } from '@/lib/f7-write-prepared'
import { enforceRateLimit } from '@/lib/rate-limit'
import { mediaUrl } from '@/lib/media-url'
import { findOwnedOrder, listOrderItems, listOrderHistory } from '@/lib/repositories/checkout-repository'
import { loadCheckoutResultContent } from '@/lib/repositories/checkout-result-repository'
import { findCapturedOrAuthorizedPayment, ensureRazorpayPaymentCaptured } from '@/lib/razorpay'
import { toRazorpayAmountInSubunits } from '@/lib/payment-subunits'
import { finalizeF7Payment } from '@/lib/f7-payment'
import { listCustomerOrders } from '@/lib/repositories/customer-orders-repository'

function amount(value: unknown, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}
function resultState(value: unknown) {
  const status = String(value ?? '').toLowerCase()
  if (['paid', 'captured', 'success'].includes(status)) return 'success'
  if (['failed', 'cancelled', 'canceled'].includes(status)) return 'failed'
  return 'pending'
}

export async function handleF7ProfileOrders(request: Request) {
  try {
    const owner = await resolveF7CheckoutOwner(request)
    if (owner?.kind !== 'customer') return f7Json({ error: 'Unauthorized.' }, 401)
    const params = new URL(request.url).searchParams
    const page = Math.max(1, Number(params.get('page') || 1))
    const pageSize = Math.min(10, Math.max(1, Number(params.get('pageSize') || 5)))
    if (!Number.isSafeInteger(page) || !Number.isInteger(pageSize) || !Number.isSafeInteger((page - 1) * pageSize)) {
      return f7Json({ error: 'Invalid pagination.' }, 400)
    }
    const result = await listCustomerOrders(owner, page, pageSize)
    return f7Json({ orders: result.orders, pagination: { page, pageSize, total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / pageSize)) } })
  } catch { return f7Json({ error: 'Unable to load orders.' }, 503) }
}

export async function handleF7Success(request: Request) {
  try {
    requireF7WritePrepared()
    const rate = await enforceRateLimit(request, { key: 'checkout-success', limit: 30, windowSeconds: 60 })
    if (!rate.ok && rate.response) return rate.response
    const owner = await resolveF7CheckoutOwner(request)
    if (!owner) return f7Json({ error: 'Unauthorized.' }, 401)
    const orderNumber = new URL(request.url).searchParams.get('order')?.trim()
    if (!orderNumber || orderNumber.length > 100) return f7Json({ error: 'Order confirmation not found.' }, 404)
    const order = await findOwnedOrder(owner, { number: orderNumber })
    if (!order) return f7Json({ error: 'Order confirmation not found.' }, 404)
    let state = resultState(order.payment_status ?? order.gateway_payment_status)
    if (state === 'pending' && order.razorpay_order_id) {
      try {
        const candidate = await findCapturedOrAuthorizedPayment(order.razorpay_order_id)
        if (candidate?.id) {
          const payment = await ensureRazorpayPaymentCaptured({ paymentId: candidate.id, orderId: order.razorpay_order_id,
            amountInSubunits: toRazorpayAmountInSubunits(Number(order.payment_amount || 0), String(order.payment_currency || '')),
            currency: String(order.payment_currency || '').toUpperCase() })
          const finalized = await finalizeF7Payment({ orderId: order.id, razorpayOrderId: order.razorpay_order_id,
            paymentId: payment.id, paymentMethod: payment.method || null,
            paymentContact: payment.contact != null ? String(payment.contact) : null, paymentEmail: payment.email || null,
            gatewayPaymentStatus: payment.status || 'captured', paymentAmountInSubunits: Number(payment.amount),
            paymentCurrency: String(payment.currency || order.payment_currency), rawEvent: payment }, owner)
          if (!(finalized.error !== undefined)) {
            state = 'success'; order.payment_status = 'paid'; order.gateway_payment_status = 'captured'
            order.gateway_order_status = 'paid'; order.razorpay_payment_id = payment.id; order.razorpay_payment_method = payment.method || null
          }
        }
      } catch { console.error('F7 order status self-reconciliation failed.') }
    }
    const [items, content, statusEvents] = await Promise.all([
      listOrderItems(owner, order.id), loadCheckoutResultContent(state), listOrderHistory(owner, order.id),
    ])
    const totals = order.gateway_payload?.totals
    const exchangeRate = amount(totals?.exchangeRate, 1)
    const coupon = order.gateway_payload?.checkout?.coupon
    // The browser needs the charged totals and the coupon, not the internal
    // gateway payload (signatures, raw provider events, full checkout copy).
    const { gateway_payload: _internalPayload, ...publicOrder } = order
    void _internalPayload
    return f7Json({ state, order: { ...publicOrder,
      coupon_code: coupon?.code || null,
      coupon_discount_amount: amount(totals?.chargedCouponDiscount, Number(coupon?.discountAmount || 0) * exchangeRate),
      subtotal_amount: amount(totals?.chargedSubtotal, Number(order.subtotal_amount || 0)),
      gst_amount: amount(totals?.chargedGst, Number(order.gst_amount || 0)),
      shipping_amount: amount(totals?.shippingCharged, Number(order.shipping_amount || 0)),
      items: items.map((item) => ({ ...item, line_total: Number((Number(item.line_total || 0) * exchangeRate).toFixed(2)) })) },
      statusEvents, cms: { page: content.page ? { ...content.page,
        main_banner_image_url: mediaUrl(content.page.main_banner_image_path),
        secondary_banner_image_url: mediaUrl(content.page.secondary_banner_image_path) } : null, state: content.state },
      contact: content.contact, categories: content.categories })
  } catch { return f7Json({ error: 'Unable to confirm this order right now.' }, 500) }
}
