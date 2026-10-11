import 'server-only'

import { query } from '@/lib/db/query'

type Promotion = {
  id: number
  cta_action: string
  cta_link: string | null
  selected_coupon_id: number | null
  is_active: boolean
}

export type PromotionQuestionRow = {
  field_key: string
  question: string
  input_type: string
  options: unknown
  allow_multiple: boolean
  validation_pattern: string | null
  validation_message: string | null
  is_required: boolean
}

type Coupon = {
  id: number
  code: string
  title: string | null
  usage_limit: number | null
  usage_count: number
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
}

export async function findSubmissionPromotion() {
  const result = await query<{ row: Promotion }>(
    `SELECT to_jsonb(p) AS row FROM (
      SELECT id, cta_action, cta_link, selected_coupon_id, is_active
      FROM public.promotion_popup WHERE section_key = $1 LIMIT 2
    ) p`,
    ['global_promotion_popup'], { operation: 'forms.promotion.read' },
  )
  if (result.rows.length > 1) throw new Error('Expected one promotion popup.')
  return result.rows[0]?.row ?? null
}

export async function loadSubmissionQuestions(promotionId: number) {
  const result = await query<PromotionQuestionRow>(
    `SELECT field_key, question, input_type, options, allow_multiple,
      validation_pattern, validation_message, is_required
      FROM public.promotion_popup_questions
      WHERE promotion_id = $1 AND is_active = true ORDER BY sort_order ASC`,
    [promotionId], { operation: 'forms.promotion.questions' },
  )
  return result.rows
}

export async function findSubmissionCoupon(couponId: number) {
  const result = await query<{ row: Coupon }>(
    `SELECT to_jsonb(c) AS row FROM (
      SELECT id, code, title, usage_limit, usage_count, is_active, starts_at, ends_at
      FROM public.coupons WHERE id = $1 LIMIT 2
    ) c`,
    [couponId], { operation: 'forms.promotion.coupon' },
  )
  if (result.rows.length > 1) throw new Error('Expected one promotion coupon.')
  return result.rows[0]?.row ?? null
}

export async function insertPromotionResponse(input: {
  promotion_id: number
  email: string | null
  answers: Record<string, string | string[]>
  coupon_revealed: boolean
  revealed_at: string | null
}) {
  await query(
    `INSERT INTO public.promotion_popup_responses
      (promotion_id, email, answers, coupon_revealed, revealed_at)
      VALUES ($1, $2, $3::jsonb, $4, $5)`,
    [input.promotion_id, input.email, JSON.stringify(input.answers), input.coupon_revealed, input.revealed_at],
    { operation: 'forms.promotion.response.insert' },
  )
}

export async function insertPromotionSubmission(input: {
  email: string
  action_type: 'redirect' | 'reveal_coupon'
  coupon_id: number | null
}) {
  await query(
    'INSERT INTO public.promotion_popup_submissions (email, action_type, coupon_id) VALUES ($1, $2, $3)',
    [input.email, input.action_type, input.coupon_id],
    { operation: 'forms.promotion.submission.insert' },
  )
}
