// Local part: letters, digits and the symbols mail providers accept; no leading/trailing/double dots.
const EMAIL_PATTERN = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/
export const PHONE_MAX_DIGITS = 15
export const PHONE_MIN_DIGITS = 8

export function isValidEmail(value: string) {
  const trimmed = value.trim()
  return trimmed.length <= 254 && trimmed.split('@')[0].length <= 64 && EMAIL_PATTERN.test(trimmed)
}

/** Typing filter for phone fields: an optional leading +, then digits only, at most 15 of them (the international maximum). */
export function sanitizePhoneInput(value: string) {
  const hasPlus = value.trimStart().startsWith('+')
  return `${hasPlus ? '+' : ''}${value.replace(/\D/g, '').slice(0, PHONE_MAX_DIGITS)}`
}

export function isValidPhone(value: string) {
  const compact = value.trim().replace(/[\s\-()]/g, '')
  const digits = compact.replace(/^\+/, '')
  return /^[0-9]+$/.test(digits) && digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS
}

/** E.164-style contact for payment providers (+digits, no spaces); empty when it is not a valid number. */
export function toPaymentContact(value: string | null | undefined) {
  if (!value || !isValidPhone(value)) return ''
  return `+${value.replace(/\D/g, '')}`
}
