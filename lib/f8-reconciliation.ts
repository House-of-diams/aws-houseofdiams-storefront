import 'server-only'
import { requireF8Prepared } from '@/lib/f8-prepared'
import { getRazorpayClient } from '@/lib/razorpay'
import { toRazorpayAmountInSubunits } from '@/lib/payment-subunits'
import { finalizeF7Payment, recoverF7CapturedPayment } from '@/lib/f7-payment'
import { claimDueRdsRecovery, expireRdsReservations, loadRdsRecoveryOrder,
  finishRdsRecovery, countRdsRecoveryAttention, claimRdsPendingOrders, finishRdsPendingOrder, escalateRdsExhaustedRecovery,
  deferRdsRecovery, type RdsRecoveryAction, type RdsDiscoveryOrder } from '@/lib/repositories/reconciliation-repository'

// Only wrap read-only provider operations: a timed-out read cannot submit a
// charge/refund after its worker releases the lease.
export async function withF8ProviderTimeout<T>(read: () => Promise<T>, timeoutMs = 4000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([read(), new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Provider read timed out.')), timeoutMs)
    })])
  } finally { if (timer) clearTimeout(timer) }
}

export async function reconcileRdsPendingOrder(order: RdsDiscoveryOrder) {
  requireF8Prepared()
  const persist = async (status: string, expire = false, review = false) =>
    await finishRdsPendingOrder(order, { status, expire, review }) ? status : 'lease_lost'
  try {
    const provider = getRazorpayClient()
    const listed = await withF8ProviderTimeout(() => provider.orders.fetchPayments(order.razorpay_order_id))
    if (!Array.isArray(listed.items) || (listed.count != null && Number(listed.count) !== listed.items.length)) {
      return await persist('manual_review', false, true)
    }
    if (listed.items.some((payment) => payment.order_id !== order.razorpay_order_id
      || !['created', 'failed', 'authorized', 'captured', 'refunded'].includes(payment.status))) {
      return await persist('manual_review', false, true)
    }
    const captured = listed.items.filter((payment) => payment.status === 'captured')
    if (captured.length > 1 || listed.items.some((payment) => Number(payment.amount_refunded || 0) > 0 || payment.status === 'refunded')) {
      return await persist('manual_review', false, true)
    }
    if (!captured.length) {
      if (listed.items.some((payment) => payment.status === 'authorized')) return await persist('awaiting_capture')
      return await persist(order.deadline_passed ? 'expired' : 'pending', order.deadline_passed)
    }
    // Fetch independently: list payloads alone are never authoritative.
    const payment = await withF8ProviderTimeout(() => provider.payments.fetch(captured[0].id))
    const amount = toRazorpayAmountInSubunits(Number(order.payment_amount), order.payment_currency)
    if (payment.id !== captured[0].id || payment.order_id !== order.razorpay_order_id
      || payment.status !== 'captured' || Number(payment.amount_refunded || 0) !== 0
      || Number(payment.amount) !== amount || payment.currency?.toUpperCase() !== order.payment_currency.toUpperCase()) {
      return await persist('manual_review', false, true)
    }
    const result = await finalizeF7Payment({ orderId: order.id, razorpayOrderId: order.razorpay_order_id,
      paymentId: payment.id, gatewayPaymentStatus: 'captured', paymentAmountInSubunits: amount,
      paymentCurrency: order.payment_currency, paymentMethod: payment.method || null,
      rawEvent: { source: 'f8-provider-discovery' } })
    if (!result.error) return await persist('paid')
    if (result.errorCode !== 'finalization_rpc_error') return await persist('manual_review', false, true)
    const recovery = await recoverF7CapturedPayment({ orderId: order.id, paymentId: payment.id,
      amountInSubunits: amount, currency: order.payment_currency, reasonCode: result.errorCode })
    return await persist(recovery.durable ? 'recovery_queued' : 'failed')
  } catch {
    return await persist('failed')
  }
}

export async function reconcileRdsRecovery(action: RdsRecoveryAction) {
  requireF8Prepared()
  const persist = async (status: string, lastError: string | null, refundId?: string) => {
    const minutes = Math.min(360, 2 ** Math.min(Math.max(action.attempt_count, 1), 8))
    return await finishRdsRecovery(action, { status, lastError, refundId,
      nextAttemptAt: new Date(Date.now() + minutes * 60_000).toISOString() }) ? status : 'lease_lost'
  }
  try {
    const order = await loadRdsRecoveryOrder(action.order_id)
    const amount = Number(action.amount_subunits)
    if (!order || order.payment_gateway !== 'razorpay' || !order.razorpay_order_id
      || !Number.isSafeInteger(amount) || amount <= 0
      || toRazorpayAmountInSubunits(Number(order.payment_amount), order.payment_currency || '') !== amount
      || order.payment_currency?.toUpperCase() !== action.currency.toUpperCase()) {
      return await persist('manual_review', 'Recovery action does not match the stored order.')
    }
    // A timeout can occur after finalization commits. Never refund a paid order.
    if (order.payment_status === 'paid') {
      return await persist('manual_review', 'Order is paid; automatic refund is blocked.')
    }
    const provider = getRazorpayClient().payments
    const payment = await withF8ProviderTimeout(() => provider.fetch(action.payment_id))
    if (payment.id !== action.payment_id || payment.order_id !== order.razorpay_order_id
      || !['captured', 'refunded'].includes(payment.status)
      || Number(payment.amount) !== amount || payment.currency?.toUpperCase() !== action.currency.toUpperCase()) {
      return await persist('manual_review', 'Gateway payment does not match the stored recovery action.')
    }
    let refund = action.provider_refund_id
      ? await withF8ProviderTimeout(() => provider.fetchRefund(action.payment_id, action.provider_refund_id!)) : null
    if (!refund) {
      // A bounded lookup cannot prove that an earlier uncertain refund did not
      // succeed. Missing/ambiguous results go to review, never another charge.
      const refunds = await withF8ProviderTimeout(() => provider.fetchMultipleRefund(action.payment_id, { count: 100 }))
      const matches = refunds.items.filter((candidate) => candidate.receipt === `recovery-${action.id}`)
      if (matches.length > 1 || refunds.items.length >= 100) {
        return await persist('manual_review', 'Refund outcome is uncertain; inspect the provider before retrying.')
      }
      if (!matches.length) {
        if (payment.status !== 'captured' || Number(payment.amount_refunded || 0) !== 0) {
          return await persist('manual_review', 'Refund outcome requires provider review.')
        }
        const finalized = await finalizeF7Payment({ orderId: action.order_id, razorpayOrderId: order.razorpay_order_id,
          paymentId: action.payment_id, gatewayPaymentStatus: 'captured', paymentAmountInSubunits: amount,
          paymentCurrency: action.currency, rawEvent: { source: 'f8-ledger-recovery' } })
        if (!finalized.error) return await persist('manual_review', 'Payment finalized; no refund issued. Confirm recovery closure.')
        if (finalized.errorCode === 'finalization_rpc_error' && action.attempt_count < 8) {
          return await persist('failed', 'Finalization verification failed; retry scheduled.')
        }
        return await persist('manual_review', 'Payment could not be finalized; refund requires reviewed operator action.')
      }
      refund = matches[0]
    }
    if (refund.payment_id !== action.payment_id || Number(refund.amount) !== amount
      || refund.currency?.toUpperCase() !== action.currency.toUpperCase()
      || (action.provider_refund_id ? refund.id !== action.provider_refund_id : refund.receipt !== `recovery-${action.id}`)) {
      return await persist('manual_review', 'Gateway refund does not match the recovery action.')
    }
    const status = refund.status === 'processed' ? 'refunded'
      : refund.status === 'failed' || action.attempt_count >= 8 ? 'manual_review' : 'refund_pending'
    return await persist(status, status === 'manual_review' ? 'Refund requires provider review.' : null, refund.id)
  } catch {
    // No provider/database exception text is stored or exposed.
    return await persist(action.attempt_count >= 8 ? 'manual_review' : 'failed', 'Recovery verification failed; retry scheduled.')
  }
}

export async function runRdsReconciliation() {
  requireF8Prepared()
  const started = Date.now()
  const expiredReservations = await expireRdsReservations()
  const pending = await claimRdsPendingOrders()
  const discoveryResults: string[] = []
  for (const order of pending) {
    try {
      if (Date.now() - started >= 15000) {
        discoveryResults.push(await finishRdsPendingOrder(order, { status: 'deferred' }) ? 'deferred' : 'lease_lost')
      } else discoveryResults.push(await reconcileRdsPendingOrder(order))
    }
    catch { discoveryResults.push('persistence_failed') }
  }
  const exhausted = await escalateRdsExhaustedRecovery()
  const actions = await claimDueRdsRecovery()
  // Sequential work bounds provider pressure and isolates individual failures.
  const results: string[] = []
  for (const action of actions) {
    try {
      if (Date.now() - started >= 35000) {
        results.push(await deferRdsRecovery(action) ? 'deferred' : 'lease_lost')
      } else results.push(await reconcileRdsRecovery(action))
    }
    catch { results.push('persistence_failed') }
  }
  const attention = await countRdsRecoveryAttention()
  const combined = [...results, ...discoveryResults]
  const failed = combined.filter((status) => ['failed', 'persistence_failed', 'lease_lost'].includes(status)).length
  const manualReview = combined.filter((status) => status === 'manual_review').length
  const summary = { ok: failed === 0, processed: results.length, discovered: pending.length,
    finalized: discoveryResults.filter((status) => status === 'paid').length,
    expiredOrders: discoveryResults.filter((status) => status === 'expired').length,
    failed, manualReview, expiredReservations, exhausted, attention,
    deferred: combined.filter((status) => status === 'deferred').length }
  if (failed || attention) console.error('F8 payment reconciliation requires attention:', summary)
  return summary
}
