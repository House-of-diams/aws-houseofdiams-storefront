// A WhatsApp recipient is 8-15 digits (E.164). A country code on its own, for example "91"
// saved with an empty local number, is not a recipient and must never reach a wa.me link.
export const FALLBACK_WHATSAPP_NUMBER = '919328536178'

export function normalizeWhatsappNumber(value: unknown): string {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : ''
  return digits.length >= 8 && digits.length <= 15 ? digits : ''
}

export const whatsappNumberOrFallback = (value: unknown) => normalizeWhatsappNumber(value) || FALLBACK_WHATSAPP_NUMBER
