import 'server-only'
import { query } from '@/lib/db/query'
import { withTransaction } from '@/lib/db/transaction'
import { requireF7WritePrepared } from '@/lib/f7-write-prepared'
import { orderResultColumns, ownerValues, type CheckoutOrder } from '@/lib/repositories/checkout-repository'
import type { F7CheckoutOwner } from '@/lib/f7-checkout-owner'

export type PaidFinalizationInput = {
  orderId: string; razorpayOrderId: string; paymentId: string
  signature?: string | null; paymentMethod?: string | null; paymentContact?: string | null
  paymentEmail?: string | null; gatewayPaymentStatus: string; paymentAmountInSubunits: number
  paymentCurrency: string; rawEvent?: unknown
}
export type FinalizationRecord = { ok: boolean; already_paid: boolean; order_id: string;
  order_number: string; total_amount: string; error_code: string | null; message: string | null }

export async function finalizeRdsOrder(input: PaidFinalizationInput, owner?: F7CheckoutOwner) {
  requireF7WritePrepared()
  return withTransaction(async (client) => {
    // Owner is required for browser callers. The signature-verified webhook
    // caller instead binds to the stored provider order reference.
    const found = await client.query<CheckoutOrder>(`select ${orderResultColumns} from public.orders
      where id = $1 and razorpay_order_id = $2 and payment_gateway = 'razorpay'
        and ($3::boolean or (user_id is null and
          ((customer_identity_id = $4::uuid and guest_token_hash is null)
            or (guest_token_hash = $5::text and customer_identity_id is null)))) for update`,
      [input.orderId, input.razorpayOrderId, !owner, ...(owner ? ownerValues(owner) : [null, null])])
    const order = found.rows[0]
    if (!order) return null
    const recovery = await client.query<{ provider_refund_id: string | null; status: string }>(`
      select provider_refund_id, status from public.payment_recovery_actions
      where provider = 'razorpay' and payment_id = $1`, [input.paymentId])
    if (recovery.rows.some((row) => row.provider_refund_id || row.status === 'refunded')) {
      return { order, result: { ok: false, already_paid: order.payment_status === 'paid', order_id: order.id,
        order_number: order.order_number, total_amount: String(order.total_amount),
        error_code: 'payment_recovery_refund_exists', message: 'Refunded payment requires review.' } }
    }
    const finalized = await client.query<FinalizationRecord>(`
      select * from public.finalize_paid_order_with_coupon_secure(
        $1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text,
        $8::text, $9::bigint, $10::text, $11::jsonb)`,
      [order.id, input.razorpayOrderId, input.paymentId, input.signature || null,
        input.paymentMethod || null, input.paymentContact || null, input.paymentEmail || null,
        input.gatewayPaymentStatus, input.paymentAmountInSubunits, input.paymentCurrency,
        input.rawEvent == null ? null : JSON.stringify(input.rawEvent)])
    const result = finalized.rows[0]
    if (!result) throw new Error('Finalization returned no result.')
    return { order, result }
  })
}

export type FailedPaymentInput = { orderId: string; razorpayOrderId: string; paymentId?: string | null;
  error?: { code?: string | null; description?: string | null; source?: string | null;
    step?: string | null; reason?: string | null; metadata?: { order_id?: string | null; payment_id?: string | null } } | null; rawEvent?: unknown }

export async function failRdsPayment(input: FailedPaymentInput, owner?: F7CheckoutOwner) {
  requireF7WritePrepared()
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(`update public.orders set payment_status = 'failed',
      gateway_payment_status = 'failed', razorpay_payment_id = $3,
      razorpay_error_code = $4, razorpay_error_description = $5, razorpay_error_source = $6,
      razorpay_error_step = $7, razorpay_error_reason = $8, payment_failed_at = now(),
      gateway_payload = coalesce(gateway_payload, '{}'::jsonb) || $9::jsonb
      where id = $1 and razorpay_order_id = $2 and payment_gateway = 'razorpay' and payment_status = 'pending'
        and ($10::boolean or (user_id is null and
          ((customer_identity_id = $11::uuid and guest_token_hash is null)
            or (guest_token_hash = $12::text and customer_identity_id is null)))) returning id`,
      [input.orderId, input.razorpayOrderId, input.paymentId || null, input.error?.code || null,
        input.error?.description || null, input.error?.source || null, input.error?.step || null,
        input.error?.reason || null, JSON.stringify({ failure: { error: input.error || null, rawEvent: input.rawEvent || null } }),
        !owner, ...(owner ? ownerValues(owner) : [null, null])])
    if (result.rowCount) await client.query('select public.release_order_inventory_reservation($1::uuid)', [input.orderId])
    return result.rowCount === 1
  })
}

export async function claimRdsWebhook(input: { eventId: string; eventType: string;
  orderId: string | null; paymentId: string | null; payload: unknown }) {
  requireF7WritePrepared()
  return withTransaction(async (client) => {
    const result = await client.query<{ claimed: boolean }>(`select public.claim_payment_webhook_event(
    $1::text, $2::text, $3::text, $4::text, $5::text, $6::jsonb) as claimed`,
    ['razorpay', input.eventId, input.eventType, input.orderId, input.paymentId, JSON.stringify(input.payload)])
    if (result.rows[0]?.claimed !== true) return null
    const lease = await client.query<{ token: string }>(`select processing_started_at::text as token
      from public.payment_webhook_events where provider = 'razorpay' and event_id = $1`, [input.eventId])
    if (!lease.rows[0]?.token) throw new Error('Webhook claim has no lease.')
    return lease.rows[0].token
  })
}

export async function completeRdsWebhook(eventId: string, leaseToken: string) {
  requireF7WritePrepared()
  const result = await query(`update public.payment_webhook_events set processed = true,
    processed_at = now(), processing_started_at = null where provider = 'razorpay' and event_id = $1
      and not processed and processing_started_at = $2::timestamptz
      and processing_started_at > now() - interval '5 minutes'`,
    [eventId, leaseToken], { operation: 'payment.webhook-complete' })
  if (result.rowCount !== 1) throw new Error('Webhook completion could not be recorded.')
}

export async function claimRdsRecovery(input: { orderId: string; paymentId: string;
  amountInSubunits: number; currency: string; reasonCode: string }) {
  requireF7WritePrepared()
  if (!Number.isSafeInteger(input.amountInSubunits) || input.amountInSubunits <= 0) throw new Error('Invalid recovery amount.')
  return withTransaction(async (client) => {
    const expected = await client.query<{ amount: string; currency: string }>(`
      select (case upper(payment_currency) when 'JPY' then round(payment_amount)
        else round(payment_amount * 100) end)::bigint as amount, upper(payment_currency) as currency
      from public.orders where id = $1 and payment_gateway = 'razorpay' and razorpay_order_id is not null for update`,
      [input.orderId])
    if (!expected.rows[0] || Number(expected.rows[0].amount) !== input.amountInSubunits
      || expected.rows[0].currency !== input.currency.toUpperCase()) throw new Error('Recovery order mismatch.')
    const result = await client.query<{ action_id: string; action_status: string; should_attempt: boolean }>(`
    select * from public.claim_payment_recovery_action($1::uuid, $2::text, $3::bigint, $4::text, $5::text)`,
    [input.orderId, input.paymentId, input.amountInSubunits, input.currency, input.reasonCode])
    if (!result.rows[0]) throw new Error('Recovery claim returned no result.')
    const action = await client.query<{ order_id: string; amount_subunits: string; currency: string }>(`
      select order_id, amount_subunits, currency from public.payment_recovery_actions where id = $1`,
      [result.rows[0].action_id])
    if (!action.rows[0] || action.rows[0].order_id !== input.orderId
      || Number(action.rows[0].amount_subunits) !== input.amountInSubunits
      || action.rows[0].currency !== input.currency.toUpperCase()) throw new Error('Conflicting recovery action.')
    return result.rows[0]
  })
}

export async function updateRdsRecovery(input: { actionId: string; status: string; refundId?: string;
  requestedAt?: string; completedAt?: string | null; lastError?: string | null }) {
  requireF7WritePrepared()
  const result = await query(`update public.payment_recovery_actions set status = $2,
    provider_refund_id = coalesce($3, provider_refund_id), requested_at = coalesce($4::timestamptz, requested_at),
    completed_at = $5::timestamptz, last_error = $6, updated_at = now() where id = $1 returning id`,
    [input.actionId, input.status, input.refundId ?? null, input.requestedAt ?? null,
      input.completedAt ?? null, input.lastError ?? null], { operation: 'payment.recovery-update' })
  if (result.rowCount !== 1) throw new Error('Recovery update could not be recorded.')
}

export async function recordRdsRefundEvent(input: { refundId: string; paymentId?: string; status: 'refunded' | 'failed' }) {
  requireF7WritePrepared()
  await query(`update public.payment_recovery_actions set status = $3, provider_refund_id = $1,
    completed_at = case when $3 = 'refunded' then now() else null end,
    last_error = case when $3 = 'failed' then 'Razorpay reported that the refund failed.' else null end,
    leased_until = null, updated_at = now() where provider = 'razorpay'
      and provider_refund_id = $1
      and ($2::text is null or payment_id = $2)
      and status <> 'refunded'`,
    [input.refundId, input.paymentId ?? null, input.status], { operation: 'payment.refund-event' })
}

export async function loadConfirmationItems(orderId: string) {
  return (await query<{ product_name: string; quantity: number; line_total: string }>(`
    select product_name, quantity, line_total from public.order_items where order_id = $1 order by created_at`,
    [orderId], { operation: 'payment.confirmation-items' })).rows
}
