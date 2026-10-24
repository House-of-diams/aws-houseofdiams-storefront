import type { LoveLetterDraft } from '@/lib/love-letter'
import type { SupportedCurrency } from '@/lib/currency'

export type CheckoutChargeQuote = {
  baseCurrency: 'USD'
  chargeCurrency: SupportedCurrency
  exchangeRate: number
  exchangeRateSource: 'fixer' | 'fallback'
  exchangeRateFetchedAt: string
  totalUsd: number
  totalCharged: number
}

export type CheckoutDisplayItem = {
  name: string
  slug: string
  metalVariantId?: string
  imageUrl?: string
  priceFrom: number
  metal?: string
  purity?: string
  sizeOrFit?: string
  gemstone?: string
  carat?: string
  /** Text to engrave, as typed on the product page. Carried to the order so fulfillment can see it. */
  engravingText?: string
  quantity: number
  gstLabel?: string
  gstPercentage?: number
  customSelections?: { dropdownId: string; optionId: string; label?: string; optionLabel?: string }[]
}

export type CheckoutSummaryData = {
  items: CheckoutDisplayItem[]
  couponCode?: string
  couponDiscount?: number
  loveLetter?: LoveLetterDraft | null
  chargeQuote?: CheckoutChargeQuote | null
  gift?: { name: string; slug: string; imageUrl?: string; originalUnitPrice: number; variantData?: Record<string, unknown> } | null
}

export type CheckoutProfileForm = {
  first_name: string
  last_name: string
  email: string
  phone: string
  birth_date: string
  anniversary_date: string
  country: string
  state: string
  district: string
  city: string
  postal_code: string
  address_line_1: string
  address_line_2: string
}

export type CheckoutPostalAreaOption = {
  id: string
  label: string
  city: string
  district: string
  state: string
  country: string
}

export type CheckoutPostalLookupState = {
  status: 'idle' | 'loading' | 'success' | 'error'
  message: string
  city?: string
  district?: string
  state?: string
  country?: string
  countryCode?: string
  locked?: boolean
}
