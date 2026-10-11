import 'server-only'
import { createHash } from 'node:crypto'
import { f7Json } from '@/lib/f7-checkout-handlers'
import { requireF7WritePrepared } from '@/lib/f7-write-prepared'
import { verifyRazorpayWebhookSignature, ensureRazorpayPaymentCaptured } from '@/lib/razorpay'
import { toRazorpayAmountInSubunits } from '@/lib/payment-subunits'
import { findGatewayOrder } from '@/lib/repositories/checkout-repository'
import { claimRdsWebhook, completeRdsWebhook, failRdsPayment, recordRdsRefundEvent } from '@/lib/repositories/payment-repository'
import { finalizeF7Payment, recoverF7CapturedPayment } from '@/lib/f7-payment'
import { REFUNDABLE_FINALIZATION_ERRORS } from '@/lib/payment-recovery'

type Entity = { id?: string; order_id?: string; payment_id?: string; amount?: number; currency?: string;
  method?: string; contact?: string; email?: string; error_code?: string; error_description?: string;
  error_source?: string; error_step?: string; error_reason?: string }
type Webhook = { event?: string; payload?: { payment?: { entity?: Entity }; order?: { entity?: Entity }; refund?: { entity?: Entity } } }

export async function handleF7Webhook(request: Request) {
  try {
    requireF7WritePrepared()
    const signature = request.headers.get('x-razorpay-signature')
    const rawBody = await request.text()
    if (!signature) return f7Json({ error: 'Missing webhook signature.' }, 400)
    if (!verifyRazorpayWebhookSignature(rawBody, signature)) return f7Json({ error: 'Invalid webhook signature.' }, 400)
    let payload: Webhook
    try { payload = JSON.parse(rawBody) } catch { return f7Json({ error: 'Malformed webhook payload.' }, 400) }
    if (!payload || typeof payload !== 'object') return f7Json({ error: 'Malformed webhook payload.' }, 400)
    const eventType = payload.event || 'unknown'
    const entity = payload.payload?.payment?.entity
    const refund = payload.payload?.refund?.entity
    const gatewayOrderId = entity?.order_id || payload.payload?.order?.entity?.id || null
    const paymentId = entity?.id || null
    // Razorpay normally supplies the event ID. A body digest also deduplicates
    // valid signed retries that omit that header.
    const eventId = request.headers.get('x-razorpay-event-id') || `body-${createHash('sha256').update(rawBody).digest('hex')}`
    const leaseToken = await claimRdsWebhook({ eventId, eventType, orderId: gatewayOrderId,
      paymentId: paymentId || refund?.payment_id || null, payload })
    if (!leaseToken) return f7Json({ ok: true, duplicate: true })
    if ((eventType === 'refund.processed' || eventType === 'refund.failed') && refund?.id) {
      await recordRdsRefundEvent({ refundId: refund.id, paymentId: refund.payment_id,
        status: eventType === 'refund.processed' ? 'refunded' : 'failed' })
    }
    if (['payment.authorized', 'payment.captured', 'order.paid'].includes(eventType) && gatewayOrderId && paymentId) {
      if (!Number.isFinite(Number(entity?.amount)) || !entity?.currency) throw new Error('Incomplete payment details.')
      const order = await findGatewayOrder(gatewayOrderId)
      if (!order) throw new Error('Order not found.')
      const amount = toRazorpayAmountInSubunits(Number(order.payment_amount || 0), String(order.payment_currency || ''))
      const currency = String(order.payment_currency || '').toUpperCase()
      if (Number(entity.amount) !== amount || entity.currency.toUpperCase() !== currency) throw new Error('Payment mismatch.')
      const payment = await ensureRazorpayPaymentCaptured({ paymentId, orderId: gatewayOrderId, amountInSubunits: amount, currency })
      const finalized = await finalizeF7Payment({ orderId: order.id, razorpayOrderId: gatewayOrderId, paymentId,
        paymentMethod: payment.method || entity.method || null,
        paymentContact: payment.contact != null ? String(payment.contact) : entity.contact || null,
        paymentEmail: payment.email || entity.email || null, gatewayPaymentStatus: payment.status || 'captured',
        paymentAmountInSubunits: Number(payment.amount), paymentCurrency: String(payment.currency || entity.currency), rawEvent: payload })
      if (finalized.error !== undefined) {
        if (!REFUNDABLE_FINALIZATION_ERRORS.has(finalized.errorCode)) throw new Error('Finalization failed.')
        const recovery = await recoverF7CapturedPayment({ orderId: finalized.orderId, paymentId,
          amountInSubunits: Number(payment.amount), currency: String(payment.currency || entity.currency), reasonCode: finalized.errorCode })
        if (!recovery.durable) throw new Error('Recovery could not be recorded.')
      }
    }
    if (eventType === 'payment.failed' && gatewayOrderId) {
      const order = await findGatewayOrder(gatewayOrderId)
      if (!order) throw new Error('Order not found.')
      await failRdsPayment({ orderId: order.id, razorpayOrderId: gatewayOrderId, paymentId,
        error: { code: entity?.error_code || null, description: entity?.error_description || null,
          source: entity?.error_source || null, step: entity?.error_step || null, reason: entity?.error_reason || null,
          metadata: { order_id: gatewayOrderId, payment_id: paymentId } }, rawEvent: payload })
    }
    await completeRdsWebhook(eventId, leaseToken)
    return f7Json({ ok: true })
  } catch { return f7Json({ error: 'Webhook handling failed.' }, 500) }
}
