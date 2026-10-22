import { isValidEmail } from '@/lib/validation'

type ValidatedQuestion = {
  input_type: 'text' | 'email' | 'phone' | 'number' | 'options'
  validation_pattern?: string | null
  validation_message?: string | null
}

// Same rules the submit endpoint applies, so an invalid answer is refused on its own step.
export function promotionAnswerError(question: ValidatedQuestion, rawValue: string): string | null {
  const value = rawValue.trim()
  if (!value) return null
  const message = (fallback: string) => question.validation_message || fallback
  if (question.input_type === 'email' && (value.length > 254 || !isValidEmail(value.toLowerCase()))) return message('Enter a valid email address.')
  if (question.input_type === 'phone' && !/^\+?[0-9][0-9\s\-()]{7,19}$/.test(value)) return message('Enter a valid phone number.')
  if (question.input_type === 'number' && !Number.isFinite(Number(value))) return message('Enter a valid number.')
  if (question.validation_pattern) {
    try {
      if (!new RegExp(question.validation_pattern.replace(/\\\\/g, '\\')).test(value)) return message('Enter a valid answer.')
    } catch {
      return null
    }
  }
  return null
}
