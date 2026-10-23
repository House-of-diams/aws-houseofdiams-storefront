import 'server-only'
import { NextResponse } from 'next/server'
import { createPendingOrder, prepareCheckoutPayload, type CheckoutPayload } from '@/lib/checkout-order'
import { resolveF7CheckoutOwner, type F7CheckoutOwner } from '@/lib/f7-checkout-owner'
import { requireF7WritePrepared } from '@/lib/f7-write-prepared'
import { enforceRateLimit } from '@/lib/rate-limit'
import { getPostgresErrorCode } from '@/lib/db/errors'
import {
  getRazorpayClient, getRazorpayKeyId, isRazorpayConfigured,
  ensureRazorpayPaymentCaptured, verifyRazorpayPaymentSignature
} from '@/lib/razorpay'
import { toRazorpayAmountInSubunits } from '@/lib/payment-subunits'
import { createCheckoutAttempt, findCheckoutAttempt, completeCheckoutAttempt, failCheckoutAttempt } from '@/lib/repositories/checkout-attempt-repository'
import { findOwnedOrder, cancelOwnedOrder, type CheckoutOrder } from '@/lib/repositories/checkout-repository'
import { failRdsPayment } from '@/lib/repositories/payment-repository'
import { finalizeF7Payment, recoverF7CapturedPayment } from '@/lib/f7-payment'
import { REFUNDABLE_FINALIZATION_ERRORS } from '@/lib/payment-recovery'
import { toPaymentContact } from '@/lib/validation'

export const f7Json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

async function browserOwner(request: Request, key: string, limit: number) {
  requireF7WritePrepared()
  const rate = await enforceRateLimit(request, { key, limit, windowSeconds: 60 })
  if (!rate.ok && rate.response) return rate.response
  return await resolveF7CheckoutOwner(request) ?? f7Json({ error: 'A valid checkout owner is required.' }, 401)
}

function repeatCheckoutResponse(order: Omit<CheckoutOrder, 'payment_amount'> & { payment_amount: number | null }, razorpayOrderId: string) {
  const totals = order.gateway_payload?.totals || {}
  return f7Json({
    orderId: order.id, orderNumber: order.order_number, razorpay: {
      keyId: getRazorpayKeyId(), orderId: razorpayOrderId,
      amount: toRazorpayAmountInSubunits(Number(order.payment_amount || 0), String(order.payment_currency || '')),
      currency: order.payment_currency, name: 'House of Diams', description: 'Secure jewellery checkout',
      prefill: {
        name: `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim(),
        email: order.customer_email || '', contact: toPaymentContact(order.customer_phone)
      },
      baseCurrency: totals.baseCurrency || 'USD', baseAmount: totals.totalAmount || 0,
      exchangeRate: totals.exchangeRate || 1, exchangeRateSource: totals.exchangeRateSource || 'fallback',
    }
  })
}

export async function handleF7Place(request: Request) {
  let owner: F7CheckoutOwner | undefined
  let attemptId: string | undefined
  let razorpayOrderId: string | undefined
  try {
    const resolved = await browserOwner(request, 'checkout-place', 8)
    if (resolved instanceof Response) return resolved
    owner = resolved
    if (!isRazorpayConfigured()) return f7Json({ error: 'Razorpay is not configured yet.' }, 500)
    const payload = await request.json().catch(() => null) as CheckoutPayload | null
    const idempotencyKey = typeof payload?.idempotencyKey === 'string' ? payload.idempotencyKey.trim() : ''
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)) return f7Json({ error: 'Invalid checkout attempt.' }, 400)
    const preparedResult = await prepareCheckoutPayload({ payload, customerIdentity: owner.kind === 'customer' ? owner : null })
    if ('error' in preparedResult) return f7Json({ error: preparedResult.error }, preparedResult.status)
    const prepared = preparedResult.data
    try {
      attemptId = await createCheckoutAttempt(owner, idempotencyKey) ?? undefined
      if (!attemptId) throw new Error('Missing attempt.')
    } catch (error) {
      if (getPostgresErrorCode(error) !== '23505') return f7Json({ error: 'Unable to reserve this checkout attempt.' }, 500)
      const existing = await findCheckoutAttempt(owner, idempotencyKey)
      if (existing?.status === 'completed' && existing.order_id && existing.razorpay_order_id) {
        const order = await findOwnedOrder(owner, { id: existing.order_id })
        if (order && order.razorpay_order_id === existing.razorpay_order_id) return repeatCheckoutResponse(order, existing.razorpay_order_id)
      }
      if (existing?.status === 'failed') return f7Json({ error: 'The previous checkout attempt failed. Please try again.', retryable: true }, 409)
      return f7Json({ error: 'This checkout attempt is already being processed.' }, 409)
    }
    const gatewayOrder = await getRazorpayClient().orders.create({
      amount: toRazorpayAmountInSubunits(prepared.chargeQuote.totalCharged, prepared.chargeQuote.chargeCurrency),
      currency: prepared.chargeQuote.chargeCurrency, receipt: `hod-${Date.now()}`,
      notes: {
        customer_email: prepared.resolvedCustomer.email,
        customer_name: `${prepared.resolvedCustomer.first_name} ${prepared.resolvedCustomer.last_name}`.trim(),
        item_count: String(prepared.normalizedItems.length)
      },
    })
    razorpayOrderId = gatewayOrder.id
    const created = await createPendingOrder({
      userId: null,
      customerIdentityId: owner.kind === 'customer' ? owner.id : null,
      guestTokenHash: owner.kind === 'guest' ? owner.hash : null,
      payload: payload || {}, prepared, razorpayOrderId
    })
    if (created.error !== undefined) {
      await failCheckoutAttempt(owner, attemptId, created.error, razorpayOrderId)
      return f7Json({ error: created.error, retryable: true }, 500)
    }
    // A persisted order remains recoverable even if attempt completion fails.
    try {
      if (!await completeCheckoutAttempt(owner, attemptId, created.data.order.id, razorpayOrderId)) {
        console.error('F7 checkout attempt completion was not recorded.')
      }
    } catch { console.error('F7 checkout attempt completion was not recorded.') }
    return f7Json({
      orderId: created.data.order.id, orderNumber: created.data.order.order_number,
      razorpay: {
        keyId: getRazorpayKeyId(), orderId: gatewayOrder.id, amount: gatewayOrder.amount,
        currency: gatewayOrder.currency, name: 'House of Diams', description: 'Secure jewellery checkout',
        prefill: {
          name: `${prepared.resolvedCustomer.first_name} ${prepared.resolvedCustomer.last_name}`.trim(),
          email: prepared.resolvedCustomer.email, contact: toPaymentContact(prepared.resolvedCustomer.phone)
        },
        baseCurrency: prepared.chargeQuote.baseCurrency, baseAmount: prepared.chargeQuote.totalUsd,
        exchangeRate: prepared.chargeQuote.exchangeRate, exchangeRateSource: prepared.chargeQuote.exchangeRateSource
      }
    })
  } catch {
    if (owner && attemptId) {
      try { await failCheckoutAttempt(owner, attemptId, 'Checkout creation failed.', razorpayOrderId) }
      catch { console.error('F7 checkout attempt failure was not recorded.') }
    }
    return f7Json({ error: 'Unable to start Razorpay checkout right now.', retryable: true }, 500)
  }
}

export async function handleF7Cancel(request: Request) {
  try {
    const owner = await browserOwner(request, 'checkout-cancel', 20)
    if (owner instanceof Response) return owner
    const payload = await request.json().catch(() => null) as { orderId?: string } | null
    if (!uuid(payload?.orderId)) return f7Json({ error: 'Missing order.' }, 400)
    const order = await findOwnedOrder(owner, { id: payload.orderId })
    if (!order) return f7Json({ error: 'Order not found.' }, 404)
    if (order.payment_status === 'paid') return f7Json({ ok: true, released: false, releaseDenied: true })
    if (order.razorpay_order_id) {
      try {
        const payments = await getRazorpayClient().orders.fetchPayments(order.razorpay_order_id)
        if (payments.items.some((payment) => payment.status !== 'failed')) return f7Json({ ok: true, released: false, releaseDenied: true })
      } catch { return f7Json({ ok: false, released: false, releaseDenied: true, error: 'Unable to confirm payment status.' }, 503) }
    }
    return f7Json({ ok: true, released: await cancelOwnedOrder(owner, order.id) })
  } catch { return f7Json({ error: 'Unable to release checkout.' }, 500) }
}

export async function handleF7Verify(request: Request) {
  try {
    const owner = await browserOwner(request, 'payment-verify', 20)
    if (owner instanceof Response) return owner
    const payload = await request.json().catch(() => null) as {
      orderId?: string; razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string
    } | null
    if (!uuid(payload?.orderId) || !payload?.razorpay_order_id || !payload.razorpay_payment_id || !payload.razorpay_signature) {
      return f7Json({ error: 'Incomplete payment verification payload.' }, 400)
    }
    const order = await findOwnedOrder(owner, { id: payload.orderId })
    if (!order) return f7Json({ error: 'Order not found.' }, 404)
    if (!order.razorpay_order_id || order.razorpay_order_id !== payload.razorpay_order_id) return f7Json({ error: 'Payment does not match this order.' }, 400)
    if (!verifyRazorpayPaymentSignature({
      orderId: payload.razorpay_order_id,
      paymentId: payload.razorpay_payment_id, signature: payload.razorpay_signature
    })) {
      await failRdsPayment({
        orderId: order.id, razorpayOrderId: order.razorpay_order_id,
        paymentId: payload.razorpay_payment_id, error: {
          code: 'signature_verification_failed',
          description: 'Razorpay signature verification failed.'
        }
      }, owner)
      return f7Json({ error: 'Payment verification failed.' }, 400)
    }
    const payment = await ensureRazorpayPaymentCaptured({
      paymentId: payload.razorpay_payment_id,
      orderId: order.razorpay_order_id,
      amountInSubunits: toRazorpayAmountInSubunits(Number(order.payment_amount || 0), String(order.payment_currency || '')),
      currency: String(order.payment_currency || '').toUpperCase()
    })
    const finalized = await finalizeF7Payment({
      orderId: order.id, razorpayOrderId: order.razorpay_order_id,
      paymentId: payload.razorpay_payment_id, signature: payload.razorpay_signature,
      paymentMethod: payment.method || null, paymentContact: payment.contact != null ? String(payment.contact) : null,
      paymentEmail: payment.email || null, gatewayPaymentStatus: payment.status || 'captured',
      paymentAmountInSubunits: Number(payment.amount), paymentCurrency: String(payment.currency || '').toUpperCase(), rawEvent: payment
    }, owner)
    if (finalized.error !== undefined) {
      if (REFUNDABLE_FINALIZATION_ERRORS.has(finalized.errorCode)) {
        const recovery = await recoverF7CapturedPayment({
          orderId: finalized.orderId, paymentId: payment.id,
          amountInSubunits: Number(payment.amount), currency: String(payment.currency), reasonCode: finalized.errorCode
        })
        if (!recovery.durable) return f7Json({ error: 'Payment was captured, but recovery could not be recorded. Please contact support with your order reference.' }, 500)
        return f7Json({
          error: 'Payment was captured. Your order confirmation is being checked; please do not pay again.',
          recoveryStatus: recovery.status
        }, 202)
      }
      return f7Json({ error: 'Payment was captured, but your order needs review. Please contact support with your order reference.' }, 500)
    }
    return f7Json({ ok: true, orderId: finalized.data.orderId, orderNumber: finalized.data.orderNumber })
  } catch { return f7Json({ error: 'Unable to verify payment right now.' }, 500) }
}
