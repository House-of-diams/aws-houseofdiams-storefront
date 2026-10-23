import { NextResponse } from 'next/server'
import {
  findSubmissionPromotion, loadSubmissionQuestions, findSubmissionCoupon,
  insertPromotionResponse, insertPromotionSubmission, type PromotionQuestionRow,
} from '@/lib/repositories/promotion-submissions-repository'
import { enforceRateLimit } from '@/lib/rate-limit'
import { isValidEmail, isValidPhone } from '@/lib/validation'

type PromotionOption = string | { id?: string | number; value?: string; label?: string }
type Question = {
  field_key: string
  question: string
  input_type: 'text' | 'email' | 'phone' | 'number' | 'options'
  options: PromotionOption[]
  allow_multiple: boolean
  validation_pattern: string | null
  validation_message: string | null
  is_required: boolean
}
type Answer = string | string[]

function optionValue(option: PromotionOption, index: number) {
  return typeof option === 'string' ? option : option.value ?? option.label ?? String(option.id ?? index)
}

function validateAnswer(question: Question, rawValue: unknown): { value: Answer } | { error: string } {
  const values = Array.isArray(rawValue)
    ? rawValue.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean)
    : typeof rawValue === 'string' && rawValue.trim() ? [rawValue.trim()] : []

  if (question.is_required && !values.length) return { error: question.validation_message || `${question.question} is required.` }
  if (!values.length) return { value: question.allow_multiple ? [] : '' }

  if (question.input_type === 'options') {
    if (!question.allow_multiple && values.length !== 1) return { error: question.validation_message || 'Choose one option.' }
    const allowedValues = new Set(question.options.map(optionValue))
    if (!allowedValues.size || !values.every((value) => allowedValues.has(value))) return { error: question.validation_message || 'Choose a valid option.' }
    return { value: question.allow_multiple ? [...new Set(values)] : values[0] }
  }

  if (values.length !== 1) return { error: question.validation_message || 'Enter one answer.' }
  const value = values[0]
  if (value.length > 500) return { error: 'This answer is too long.' }
  if (question.input_type === 'email' && (value.length > 254 || !isValidEmail(value.toLowerCase()))) return { error: question.validation_message || 'Enter a valid email address.' }
  if (question.input_type === 'phone' && !isValidPhone(value)) return { error: question.validation_message || 'Enter a valid phone number.' }
  if (question.input_type === 'number' && !Number.isFinite(Number(value))) return { error: question.validation_message || 'Enter a valid number.' }
  if (question.validation_pattern) {
    try {
      const normalizedPattern = question.validation_pattern.replace(/\\\\/g, '\\')
      if (!new RegExp(normalizedPattern).test(value)) return { error: question.validation_message || 'Enter a valid answer.' }
    } catch {
      return { error: 'This question has an invalid validation rule.' }
    }
  }
  return { value }
}

export async function POST(request: Request) {
  const rateLimit = await enforceRateLimit(request, { key: 'promotion-popup-submit', limit: 5, windowSeconds: 60 })
  if (!rateLimit.ok && rateLimit.response) return rateLimit.response
  if (!process.env.DATABASE_URL?.trim()) return NextResponse.json({ error: 'Promotion response collection is not configured.' }, { status: 503 })

  const body = await request.json().catch(() => null)
  const submittedAnswers = body?.answers && typeof body.answers === 'object' && !Array.isArray(body.answers) ? body.answers as Record<string, unknown> : {}
  if (typeof body?.email === 'string' && !submittedAnswers.email) submittedAnswers.email = body.email

  const promotion = await findSubmissionPromotion().catch(() => null)
  if (!promotion?.is_active) return NextResponse.json({ error: 'This promotion is no longer available.' }, { status: 410 })

  const questionRows: PromotionQuestionRow[] = await loadSubmissionQuestions(promotion.id).catch(() => [])
  const questions: Question[] = !questionRows.length
    ? [{ field_key: 'email', question: 'Email address', input_type: 'email', options: [], allow_multiple: false, validation_pattern: null, validation_message: 'Enter a valid email address.', is_required: true }]
    : questionRows.map((question) => ({
      field_key: question.field_key,
      question: question.question,
      input_type: question.input_type === 'options' ? 'options' : question.input_type as Question['input_type'],
      options: Array.isArray(question.options) ? question.options as PromotionOption[] : [],
      allow_multiple: question.allow_multiple === true,
      validation_pattern: question.validation_pattern,
      validation_message: question.validation_message,
      is_required: question.is_required !== false,
    }))

  const answers: Record<string, Answer> = {}
  for (const question of questions) {
    const result = validateAnswer(question, submittedAnswers[question.field_key])
    if ('error' in result) return NextResponse.json({ error: result.error, field: question.field_key }, { status: 400 })
    if (Array.isArray(result.value) ? result.value.length : result.value) answers[question.field_key] = result.value
  }

  const actionType = promotion.cta_action === 'reveal_coupon' ? 'reveal_coupon' : 'redirect'
  let coupon: { id: number; code: string; title: string | null } | null = null
  if (actionType === 'reveal_coupon') {
    if (promotion.selected_coupon_id == null) return NextResponse.json({ error: 'This coupon is no longer available.' }, { status: 410 })
    const data = await findSubmissionCoupon(promotion.selected_coupon_id).catch(() => null)
    const now = Date.now()
    if (!data?.is_active || (data.starts_at && Date.parse(data.starts_at) > now) || (data.ends_at && Date.parse(data.ends_at) <= now) || (data.usage_limit != null && Number(data.usage_count ?? 0) >= Number(data.usage_limit))) return NextResponse.json({ error: 'This coupon is no longer available.' }, { status: 410 })
    coupon = { id: Number(data.id), code: data.code, title: data.title }
  }

  const email = typeof answers.email === 'string' ? answers.email.toLowerCase() : null
  try {
    await insertPromotionResponse({ promotion_id: promotion.id, email, answers, coupon_revealed: actionType === 'reveal_coupon', revealed_at: actionType === 'reveal_coupon' ? new Date().toISOString() : null })
  } catch {
    return NextResponse.json({ error: 'Unable to save your answers. Please try again.' }, { status: 500 })
  }

  // This secondary email record remains best-effort, as in the existing flow.
  if (email) await insertPromotionSubmission({ email, action_type: actionType, coupon_id: coupon?.id ?? null }).catch(() => undefined)
  if (actionType === 'reveal_coupon' && coupon) return NextResponse.json({ ok: true, action: actionType, coupon: { code: coupon.code, title: coupon.title } })
  return NextResponse.json({ ok: true, action: 'redirect', redirectUrl: promotion.cta_link || '/' })
}
