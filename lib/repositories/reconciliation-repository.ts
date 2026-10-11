import 'server-only'
import { query } from '@/lib/db/query'
import { requireF8Prepared } from '@/lib/f8-prepared'

export type RdsRecoveryAction = {
  id: string; order_id: string; payment_id: string; amount_subunits: string | number;
  currency: string; provider_refund_id: string | null; attempt_count: number; leased_until: string
}

export type RdsDiscoveryOrder = {
  id: string; razorpay_order_id: string; payment_amount: string; payment_currency: string;
  payment_status: string; status: string; lease_token: string; deadline_passed: boolean
}

// Reuse the installed reservation function's 15-minute checkout window, but
// expiration is a gateway marker only: late verified captures still reconcile.
export async function claimRdsPendingOrders() {
  requireF8Prepared()
  return (await query<RdsDiscoveryOrder>(`with due as (
    select id from public.orders
    where fulfillment_mode = 'made_to_order' and payment_gateway = 'razorpay'
      and payment_status in ('pending', 'failed') and status = 'pending'
      and razorpay_order_id is not null
      and coalesce(gateway_payload #>> '{f8Reconciliation,reviewRequired}', 'false') <> 'true'
      and (case when jsonb_typeof(gateway_payload #> '{f8Reconciliation,leaseUntilEpoch}') = 'number'
        then (gateway_payload #>> '{f8Reconciliation,leaseUntilEpoch}')::numeric else 0 end) < extract(epoch from now())
      and (case when jsonb_typeof(gateway_payload #> '{f8Reconciliation,nextCheckEpoch}') = 'number'
        then (gateway_payload #>> '{f8Reconciliation,nextCheckEpoch}')::numeric else 0 end) <= extract(epoch from now())
    order by (case when jsonb_typeof(gateway_payload #> '{f8Reconciliation,nextCheckEpoch}') = 'number'
      then (gateway_payload #>> '{f8Reconciliation,nextCheckEpoch}')::numeric else 0 end), created_at, id
    limit $1::integer for update skip locked
  ) update public.orders o set gateway_payload = coalesce(o.gateway_payload, '{}'::jsonb)
    || jsonb_build_object('f8Reconciliation', coalesce(o.gateway_payload->'f8Reconciliation', '{}'::jsonb)
      || jsonb_build_object('leaseToken', gen_random_uuid()::text,
        'leaseUntilEpoch', extract(epoch from now() + interval '5 minutes')))
    from due where o.id = due.id
    returning o.id, o.razorpay_order_id, o.payment_amount, o.payment_currency, o.payment_status, o.status,
      o.gateway_payload #>> '{f8Reconciliation,leaseToken}' as lease_token,
      o.created_at <= now() - interval '15 minutes' as deadline_passed`,
    [20], { operation: 'reconciliation.discovery-claim' })).rows
}

export async function finishRdsPendingOrder(order: RdsDiscoveryOrder, outcome: {
  status: string; expire?: boolean; review?: boolean
}) {
  requireF8Prepared()
  return (await query(`update public.orders set
    gateway_order_status = case when $3::boolean and payment_status in ('pending', 'failed') and status = 'pending'
      and gateway_order_status in ('created', 'pending', 'checkout_dismissed')
      and created_at <= now() - interval '15 minutes' then 'expired' else gateway_order_status end,
    gateway_payload = coalesce(gateway_payload, '{}'::jsonb) || jsonb_build_object('f8Reconciliation',
      coalesce(gateway_payload->'f8Reconciliation', '{}'::jsonb) || jsonb_build_object(
        'leaseToken', null, 'leaseUntilEpoch', 0, 'nextCheckEpoch', extract(epoch from now() + interval '10 minutes'),
        'lastResult', $4::text, 'reviewRequired', $5::boolean, 'checkedAt', now()))
    where id = $1 and fulfillment_mode = 'made_to_order' and payment_gateway = 'razorpay'
      and gateway_payload #>> '{f8Reconciliation,leaseToken}' = $2
      and (gateway_payload #>> '{f8Reconciliation,leaseUntilEpoch}')::numeric > extract(epoch from now())
    returning id`, [order.id, order.lease_token, outcome.expire ?? false, outcome.status, outcome.review ?? false],
    { operation: 'reconciliation.discovery-complete' })).rowCount === 1
}

export async function expireRdsReservations() {
  requireF8Prepared()
  const result = await query<{ count: number }>('select public.expire_inventory_reservations($1::integer) as count',
    [1000], { operation: 'reconciliation.expire' })
  return Number(result.rows[0]?.count || 0)
}

export async function claimDueRdsRecovery() {
  requireF8Prepared()
  // Preserve PostgreSQL microseconds; pg's default Date parsing truncates them
  // and would make the exact lease comparison fail on every completion.
  return (await query<RdsRecoveryAction>(`select id, order_id, payment_id, amount_subunits, currency,
    provider_refund_id, attempt_count, leased_until::text as leased_until
    from public.claim_due_payment_recovery_actions($1::integer)`,
    [20], { operation: 'reconciliation.claim' })).rows
}

export async function escalateRdsExhaustedRecovery() {
  requireF8Prepared()
  return (await query(`with exhausted as (
    select id from public.payment_recovery_actions where provider = 'razorpay'
      and status in ('processing', 'refund_pending', 'failed') and attempt_count >= 8
      and (leased_until is null or leased_until < now()) order by updated_at, id
      limit $1::integer for update skip locked
  ) update public.payment_recovery_actions a set status = 'manual_review', leased_until = null,
    last_error = 'Recovery attempts exhausted; operator review required.', updated_at = now()
    from exhausted where a.id = exhausted.id returning a.id`, [20],
    { operation: 'reconciliation.exhausted' })).rowCount ?? 0
}

export async function loadRdsRecoveryOrder(orderId: string) {
  requireF8Prepared()
  return (await query<{ payment_gateway: string; razorpay_order_id: string | null;
    payment_status: string; payment_amount: string; payment_currency: string | null }>(`
    select payment_gateway, razorpay_order_id, payment_status, payment_amount, payment_currency
    from public.orders where id = $1`, [orderId], { operation: 'reconciliation.order' })).rows[0] ?? null
}

export async function finishRdsRecovery(action: RdsRecoveryAction, result: {
  status: string; lastError: string | null; refundId?: string; nextAttemptAt: string
}) {
  requireF8Prepared()
  // Claim generation + lease predicates prevent stale workers overwriting a
  // newer claim or a terminal webhook result. No new SQL function/grant.
  return (await query(`update public.payment_recovery_actions set status = $2,
    provider_refund_id = coalesce($3, provider_refund_id), last_error = $4,
    completed_at = case when $2 = 'refunded' then now() else null end,
    next_attempt_at = $5::timestamptz, leased_until = null, updated_at = now()
    where id = $1 and attempt_count = $6 and leased_until = $7::timestamptz
      and leased_until > now() and status in ('processing', 'refund_pending', 'failed') returning id`,
    [action.id, result.status, result.refundId ?? null, result.lastError, result.nextAttemptAt,
      action.attempt_count, action.leased_until], { operation: 'reconciliation.complete' })).rowCount === 1
}

export async function deferRdsRecovery(action: RdsRecoveryAction) {
  requireF8Prepared()
  return (await query(`update public.payment_recovery_actions set leased_until = null,
    attempt_count = greatest(1, attempt_count - 1), next_attempt_at = now() + interval '1 minute', updated_at = now()
    where id = $1 and attempt_count = $2 and leased_until = $3::timestamptz
      and leased_until > now() and status in ('processing', 'refund_pending', 'failed') returning id`,
    [action.id, action.attempt_count, action.leased_until], { operation: 'reconciliation.defer' })).rowCount === 1
}

export async function countRdsRecoveryAttention() {
  requireF8Prepared()
  return Number((await query<{ count: string }>(`select (
    (select count(*) from public.payment_recovery_actions
    where provider = 'razorpay' and (status = 'manual_review'
      or (status in ('processing', 'refund_pending', 'failed') and attempt_count >= 8)))
    + (select count(*) from public.orders where fulfillment_mode = 'made_to_order'
      and payment_status <> 'paid' and gateway_payload #>> '{f8Reconciliation,reviewRequired}' = 'true')
    + (select count(*) from public.payment_webhook_events where provider = 'razorpay' and not processed
      and coalesce(processing_started_at, created_at) < now() - interval '5 minutes')
    )::text as count`,
    [], { operation: 'reconciliation.attention' })).rows[0]?.count || 0)
}
