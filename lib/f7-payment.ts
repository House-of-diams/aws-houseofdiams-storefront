import 'server-only'
import { sendOrderConfirmationEmail } from '@/lib/email'
import type { F7CheckoutOwner } from '@/lib/f7-checkout-owner'
import { finalizeRdsOrder, loadConfirmationItems, claimRdsRecovery,
  type PaidFinalizationInput } from '@/lib/repositories/payment-repository'

export async function finalizeF7Payment(input: PaidFinalizationInput, owner?: F7CheckoutOwner) {
  let finalized
  try { finalized = await finalizeRdsOrder(input, owner) } catch {
    return { error: 'Unable to finalize payment.', errorCode: 'finalization_rpc_error', orderId: input.orderId } as const
  }
  if (!finalized) return { error: 'Order not found.', errorCode: 'order_not_found', orderId: input.orderId } as const
  const { order, result } = finalized
  if (!result.ok) return { error: result.message || 'Unable to finalize payment.',
    errorCode: result.error_code || 'inventory_finalization_failed', orderId: order.id } as const
  if (!result.already_paid) {
    try {
      const items = await loadConfirmationItems(order.id)
      const totals = order.gateway_payload?.totals
      const coupon = order.gateway_payload?.checkout?.coupon
      // The paid order is only finalized once, so a later retry would skip the email. Try a few times now instead of giving up on the first failure.
      let sent = false
      for (let attempt = 0; attempt < 3 && !sent; attempt += 1) {
        if (attempt) await new Promise((resolve) => setTimeout(resolve, attempt === 1 ? 600 : 1500))
        try {
        await sendOrderConfirmationEmail({
          customerEmail: order.customer_email || '',
          customerName: [order.customer_first_name, order.customer_last_name].filter(Boolean).join(' ') || 'Client',
          orderNumber: order.order_number, orderDate: order.created_at,
          subtotalAmount: Number((totals?.chargedSubtotal ?? order.subtotal_amount) || 0),
          gstAmount: Number((totals?.chargedGst ?? order.gst_amount) || 0),
          gstLabel: String(totals?.gstLabel || 'Taxes'), gstPercentage: Number(totals?.gstPercentage || 0),
          shippingAmount: Number((totals?.shippingCharged ?? order.shipping_amount) || 0),
          couponCode: coupon?.code || null,
          couponDiscountAmount: Number((totals?.chargedCouponDiscount ?? coupon?.discountAmount) || 0),
          totalAmount: Number(order.payment_amount || order.total_amount || 0), currency: order.payment_currency || 'USD',
          items: items.map((item) => ({ product_name: item.product_name, quantity: Number(item.quantity || 0),
            line_total: Number(item.line_total || 0) * Number(totals?.exchangeRate || 1) })),
        })
          sent = true
        } catch { /* try again */ }
      }
      if (!sent) console.error('F7 order confirmation email could not be sent after 3 attempts.')
    } catch { console.error('F7 order confirmation email could not be prepared.') }
  }
  return { data: { orderId: result.order_id, orderNumber: result.order_number } } as const
}

export async function recoverF7CapturedPayment(input: { orderId: string; paymentId: string;
  amountInSubunits: number; currency: string; reasonCode: string }) {
  let claim
  try { claim = await claimRdsRecovery(input) } catch {
    return { durable: false, error: 'Unable to record payment recovery.' } as const
  }
  if (!claim.should_attempt) return { durable: true, status: claim.action_status, duplicate: true } as const
  // A transport error can follow a committed finalization. Queue verified
  // recovery instead of refunding an order that another worker may have paid.
  // Neither browser/webhook recovery nor the RDS cron issues refunds.
  return { durable: true, status: claim.action_status } as const
}
