import 'server-only'

import { query } from '@/lib/db/query'
import type { F7CheckoutOwner } from '@/lib/f7-checkout-owner'
import { requireF7WritePrepared } from '@/lib/f7-write-prepared'

export type CheckoutAttemptRecord = {
  id: string
  status: string
  order_id: string | null
  razorpay_order_id: string | null
}

function ownerColumns(owner: F7CheckoutOwner) {
  return {
    customerIdentityId: owner.kind === 'customer' ? owner.id : null,
    guestTokenHash: owner.kind === 'guest' ? owner.hash : null,
  }
}

export async function createCheckoutAttempt(owner: F7CheckoutOwner, idempotencyKey: string) {
  requireF7WritePrepared()
  const { customerIdentityId, guestTokenHash } = ownerColumns(owner)
  const result = await query<{ id: string }>(`
    INSERT INTO public.checkout_attempts
      (user_id, customer_identity_id, guest_token_hash, idempotency_key, status)
    VALUES (NULL, $1, $2, $3, 'processing')
    RETURNING id
  `, [customerIdentityId, guestTokenHash, idempotencyKey], { operation: 'checkout_attempt_create' })
  return result.rows[0]?.id ?? null
}

export async function findCheckoutAttempt(owner: F7CheckoutOwner, idempotencyKey: string) {
  const { customerIdentityId, guestTokenHash } = ownerColumns(owner)
  const result = await query<CheckoutAttemptRecord>(`
    SELECT id, status, order_id, razorpay_order_id
    FROM public.checkout_attempts
    WHERE idempotency_key = $1
      AND (($2::uuid IS NOT NULL AND customer_identity_id = $2::uuid)
        OR ($3::text IS NOT NULL AND guest_token_hash = $3::text))
    LIMIT 1
  `, [idempotencyKey, customerIdentityId, guestTokenHash], { operation: 'checkout_attempt_find' })
  return result.rows[0] ?? null
}

export async function completeCheckoutAttempt(
  owner: F7CheckoutOwner,
  attemptId: string,
  orderId: string,
  razorpayOrderId: string,
) {
  requireF7WritePrepared()
  const { customerIdentityId, guestTokenHash } = ownerColumns(owner)
  const result = await query<{ id: string }>(`
    UPDATE public.checkout_attempts
    SET status = 'completed', order_id = $2, razorpay_order_id = $3,
        failure_reason = NULL, updated_at = now()
    WHERE id = $1 AND status = 'processing'
      AND (($4::uuid IS NOT NULL AND customer_identity_id = $4::uuid)
        OR ($5::text IS NOT NULL AND guest_token_hash = $5::text))
    RETURNING id
  `, [attemptId, orderId, razorpayOrderId, customerIdentityId, guestTokenHash], { operation: 'checkout_attempt_complete' })
  return result.rowCount === 1
}

export async function failCheckoutAttempt(
  owner: F7CheckoutOwner,
  attemptId: string,
  failureReason: string,
  razorpayOrderId?: string,
) {
  requireF7WritePrepared()
  const { customerIdentityId, guestTokenHash } = ownerColumns(owner)
  const result = await query<{ id: string }>(`
    UPDATE public.checkout_attempts
    SET status = 'failed', failure_reason = $2,
        razorpay_order_id = COALESCE($3, razorpay_order_id), updated_at = now()
    WHERE id = $1 AND status = 'processing'
      AND (($4::uuid IS NOT NULL AND customer_identity_id = $4::uuid)
        OR ($5::text IS NOT NULL AND guest_token_hash = $5::text))
    RETURNING id
  `, [attemptId, failureReason, razorpayOrderId ?? null, customerIdentityId, guestTokenHash], { operation: 'checkout_attempt_fail' })
  return result.rowCount === 1
}
