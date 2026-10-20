import 'server-only'
import { buildCheckoutChargeQuote } from '@/lib/exchange-rates'
import { resolveAuthoritativeCheckoutPricing } from '@/lib/checkout-pricing'
import { isValidEmail, isValidPhone } from '@/lib/validation'
import { loadCheckoutCustomerProfile, loadCheckoutDropdownGroups, loadCheckoutDropdownOptions } from '@/lib/repositories/checkout-profile-repository'
import { requireF7WritePrepared } from '@/lib/f7-write-prepared'
import { createRdsPendingOrder } from '@/lib/repositories/checkout-repository'

export type CheckoutPayload = {
  idempotencyKey?: string
  item?: CheckoutPayloadItem | null
  items?: CheckoutPayloadItem[]
  customer?: {
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    birth_date?: string
    anniversary_date?: string
    country?: string
    state?: string
    district?: string
    city?: string
    postal_code?: string
    address_line_1?: string
    address_line_2?: string
  }
  coupon?: {
    id?: number
    code?: string
  } | null
  currencyCode?: string | null
  loveLetter?: {
    wantsLetter?: boolean
    letterType?: 'generate_for_me' | 'write_myself' | 'no_letter'
    recipientName?: string
    senderName?: string
    occasionKey?: 'proposal' | 'anniversary' | 'birthday' | 'justbecause' | 'apology' | 'mother' | 'newchapter' | null
    aboutHerText?: string
    customLetterText?: string
    finalLetterText?: string
    finalLetterHtml?: string
  } | null
}

export type CheckoutPayloadItem = {
  name: string
  slug: string
  metalVariantId?: string
  imageUrl?: string
  priceFrom?: number
  metal?: string
  purity?: string
  sizeOrFit?: string
  gemstone?: string
  carat?: string
  quantity: number
  gstLabel?: string
  gstPercentage?: number
  customSelections?: { dropdownId: string; optionId: string; label?: string; optionLabel?: string }[]
}

type PreparedItem = {
  entry: CheckoutPayloadItem
  product: {
    id: string
    slug: string
    sku: string | null
    gst_slab_id: string | null
    base_price: number | null
    default_purity_price_id: string | null
    stock_quantity: number | null
    allow_checkout: boolean | null
    status: string | null
  } | null
  quantity: number
  unitPrice: number
  subtotalAmount: number
  gstPercentage: number
  gstLabel: string
  gstAmount: number
  gstSlabId: string | null
  selectedCustomDropdowns: { dropdown_id: string; name: string; label: string; option_id: string; option_label: string; option_value: string }[]
  /** Server-derived values recorded on the order; never taken from the request. */
  productName: string
  metalLabel: string | null
  imageUrl: string
}

// Free-text selections (size, gemstone, carat) do not affect price. Keep them as
// the shopper chose them, but bounded and free of control characters.
function cleanSelection(value: unknown, maxLength = 80) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength) : ''
}

const LOVE_LETTER_LIMITS = {
  recipientName: 120, senderName: 120, aboutHerText: 2_000,
  customLetterText: 6_000, finalLetterText: 6_000, finalLetterHtml: 30_000,
} as const

type ProductRow = {
  id: string
  slug: string
  sku: string | null
  gst_slab_id: string | null
  base_price: number | null
  default_purity_price_id: string | null
  stock_quantity: number | null
  allow_checkout: boolean | null
  status: string | null
  custom_dropdowns_enabled?: boolean | null
}

type MetalVariantRow = {
  id: string
  product_id: string
  price: number | null
}

type PurityPriceRow = {
  id: string
  product_id: string
  purity_label: string | null
  price: number | null
  sort_order: number | null
}

type CustomDropdownGroupRow = {
  id: string
  product_id: string
  name: string
  label: string
  is_required: boolean | null
}

type CustomDropdownOptionRow = {
  id: string
  dropdown_id: string
  label: string
  value: string
  display_order?: number | null
}

type PreparedCheckout = {
  normalizedItems: PreparedItem[]
  subtotalAmount: number
  gstAmount: number
  gstLabel: string
  gstPercentage: number
  couponId: number | null
  couponCode: string | null
  couponDiscountAmount: number
  couponRewardType: 'percentage' | 'fixed' | 'free_gift' | null
  gift: { productId: string; name: string; slug: string; sku: string | null; imageUrl: string; originalUnitPrice: number; variantData: Record<string, unknown> } | null
  totalAmount: number
  loveLetter: CheckoutPayload['loveLetter'] | null
  chargeQuote: Awaited<ReturnType<typeof buildCheckoutChargeQuote>>
  resolvedCustomer: {
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
}

type PendingOrderRecord = {
  id: string
  order_number: string
  customer_email: string | null
  customer_first_name: string | null
  customer_last_name: string | null
  total_amount: number | null
  created_at: string | null
}

function isValidPostalCode(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9\s-]{2,11}$/.test(value.trim())
}

function buildSelectionLabel(metal?: string | null, purity?: string | null) {
  const normalizedMetal = metal?.trim() || ''
  const normalizedPurity = purity?.trim() || ''
  if (!normalizedMetal) return normalizedPurity
  if (!normalizedPurity || normalizedMetal.toLowerCase().includes(normalizedPurity.toLowerCase())) return normalizedMetal
  return `${normalizedPurity} ${normalizedMetal}`.trim()
}

function buildGatewayPayload(input: {
  payload: CheckoutPayload
  prepared: PreparedCheckout
  razorpayOrderId?: string | null
  paymentId?: string | null
  signature?: string | null
  paymentMethod?: string | null
  paymentEmail?: string | null
  paymentContact?: string | null
  eventType?: string | null
  rawEvent?: unknown
}) {
  return {
    checkout: {
      customer: input.prepared.resolvedCustomer,
      items: input.prepared.normalizedItems.map(({ entry, quantity, unitPrice, subtotalAmount, gstAmount, gstPercentage, gstLabel, productName, metalLabel, imageUrl }) => ({
        ...entry,
        name: productName,
        metal: metalLabel ?? entry.metal,
        purity: metalLabel ? '' : entry.purity,
        imageUrl,
        quantity,
        unitPrice,
        subtotalAmount,
        gstAmount,
        gstPercentage,
        gstLabel,
      })),
      coupon: input.prepared.couponId && input.prepared.couponCode
        ? {
          id: input.prepared.couponId,
          code: input.prepared.couponCode,
          discountAmount: input.prepared.couponDiscountAmount,
          rewardType: input.prepared.couponRewardType,
          gift: input.prepared.gift,
        }
        : null,
      loveLetter: input.payload.loveLetter || null,
    },
    totals: {
      subtotalAmount: input.prepared.subtotalAmount,
      gstAmount: input.prepared.gstAmount,
      gstLabel: input.prepared.gstLabel,
      gstPercentage: input.prepared.gstPercentage,
      couponDiscountAmount: input.prepared.couponDiscountAmount,
      totalAmount: input.prepared.totalAmount,
      price_usd: input.prepared.totalAmount,
      price_local: input.prepared.chargeQuote.totalCharged,
      currency_charged: input.prepared.chargeQuote.chargeCurrency,
      baseCurrency: 'USD',
      chargeCurrency: input.prepared.chargeQuote.chargeCurrency,
      exchangeRate: input.prepared.chargeQuote.exchangeRate,
      exchangeRateSource: input.prepared.chargeQuote.exchangeRateSource,
      exchangeRateFetchedAt: input.prepared.chargeQuote.exchangeRateFetchedAt,
      chargedSubtotal: input.prepared.chargeQuote.subtotalCharged,
      chargedGst: input.prepared.chargeQuote.gstCharged,
      chargedCouponDiscount: input.prepared.chargeQuote.couponDiscountCharged,
      chargedTotal: input.prepared.chargeQuote.totalCharged,
    },
    payment: {
      razorpayOrderId: input.razorpayOrderId || null,
      razorpayPaymentId: input.paymentId || null,
      razorpaySignature: input.signature || null,
      paymentMethod: input.paymentMethod || null,
      paymentEmail: input.paymentEmail || null,
      paymentContact: input.paymentContact || null,
      eventType: input.eventType || null,
    },
    rawEvent: input.rawEvent || null,
  }
}

export async function prepareCheckoutPayload({
  payload,
  customerIdentity,
}: {
  payload: CheckoutPayload | null
  customerIdentity?: { id: string; email: string } | null
}) {

  const checkoutItems = (payload?.items?.length ? payload.items : payload?.item ? [payload.item] : []).filter(Boolean) as CheckoutPayloadItem[]

  if (!checkoutItems.length || checkoutItems.some((entry) => !entry?.name || !entry.slug)) {
    return { error: 'Invalid checkout payload.', status: 400 as const }
  }

  const profileResult = customerIdentity
    ? { data: await loadCheckoutCustomerProfile(customerIdentity.id), error: null as { code?: string; message: string } | null }
    : { data: null, error: null as { code?: string; message: string } | null }
  const profile = profileResult.data

  if (profileResult.error) {
    return { error: profileResult.error.message, status: 500 as const }
  }

  const pricingResult = await resolveAuthoritativeCheckoutPricing({
    items: checkoutItems,
    coupon: payload?.coupon ?? null,
  })
  if ('error' in pricingResult) {
    return { error: pricingResult.error, status: pricingResult.status }
  }
  const pricing = pricingResult.data
  const productRows = pricing.lines.map((line) => line.product)
  const productIds = productRows.map((product) => product.id)
  const groupsResult = productIds.length
    ? { data: await loadCheckoutDropdownGroups(productIds), error: null as { code?: string; message: string } | null }
    : { data: [], error: null as { code?: string; message: string } | null }
  if (groupsResult.error) return { error: groupsResult.error.message, status: 500 as const }
  const dropdownGroups = (groupsResult.data || []) as CustomDropdownGroupRow[]
  const groupIds = dropdownGroups.map((group) => group.id)
  const optionsResult = groupIds.length
    ? { data: await loadCheckoutDropdownOptions(groupIds), error: null as { code?: string; message: string } | null }
    : { data: [], error: null as { code?: string; message: string } | null }
  if (optionsResult.error) return { error: optionsResult.error.message, status: 500 as const }
  const dropdownOptions = (optionsResult.data || []) as CustomDropdownOptionRow[]
  let selectionError = ''
  const normalizedItems: PreparedItem[] = pricing.lines.map((line) => {
    const entry = checkoutItems.find((item) => item.slug === line.entry.slug && item.metalVariantId === line.entry.metalVariantId) || (line.entry as CheckoutPayloadItem)
    const groups = line.product.custom_dropdowns_enabled ? dropdownGroups.filter((group) => group.product_id === line.product.id) : []
    const requested = new Map((entry.customSelections || []).map((selection) => [selection.dropdownId, selection.optionId]))
    if (requested.size !== (entry.customSelections || []).length || [...requested.keys()].some((groupId) => !groups.some((group) => group.id === groupId))) {
      selectionError = 'One or more custom product selections are invalid.'
    }
    const selectedCustomDropdowns = groups.flatMap((group) => {
      const requestedOptionId = requested.get(group.id)
      const option = requestedOptionId
        ? dropdownOptions.find((candidate) => candidate.dropdown_id === group.id && candidate.id === requestedOptionId)
        : group.is_required
          ? dropdownOptions.find((candidate) => candidate.dropdown_id === group.id)
          : null
      if (requestedOptionId && !option) {
        selectionError = `Invalid selection for ${group.label}.`
        return []
      }
      if (!option) {
        if (group.is_required) selectionError = `${group.label} is unavailable for this product.`
        return []
      }
      return [{ dropdown_id: group.id, name: group.name, label: group.label, option_id: option.id, option_label: option.label, option_value: option.value }]
    })

    return {
      entry: {
        ...entry,
        metal: cleanSelection(entry.metal, 120),
        purity: cleanSelection(entry.purity, 40),
        sizeOrFit: cleanSelection(entry.sizeOrFit),
        gemstone: cleanSelection(entry.gemstone),
        carat: cleanSelection(entry.carat),
      },
      product: line.product,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      subtotalAmount: line.subtotalAmount,
      gstPercentage: line.gstPercentage,
      gstLabel: line.gstLabel,
      gstAmount: line.gstAmount,
      gstSlabId: line.gstSlabId,
      selectedCustomDropdowns,
      productName: line.product.name,
      metalLabel: line.metalLabel,
      imageUrl: line.imageUrl,
    }
  })
  if (selectionError) return { error: selectionError, status: 400 as const }

  const { subtotalAmount, gstAmount, gstLabel, gstPercentage, couponId, couponCode, couponDiscountAmount, couponRewardType, gift, totalAmount } = pricing
  const loveLetter = payload?.loveLetter ?? null
  if (loveLetter) {
    for (const [field, limit] of Object.entries(LOVE_LETTER_LIMITS)) {
      const value = (loveLetter as Record<string, unknown>)[field]
      if (value != null && (typeof value !== 'string' || value.length > limit)) {
        return { error: 'The love letter is too long. Please shorten it and try again.', status: 400 as const }
      }
    }
  }
  const customer = payload?.customer ?? {}
  const profileDate = (value: unknown) => value instanceof Date
    ? value.toISOString().slice(0, 10)
    : typeof value === 'string' ? value : ''
  const resolvedCustomer = {
    first_name: (customer.first_name || profile?.first_name || '' || '').trim(),
    last_name: (customer.last_name || profile?.last_name || '' || '').trim(),
    email: (customer.email || (customerIdentity?.email) || '' || '').trim(),
    phone: (customer.phone || profile?.phone || '' || '').trim(),
    birth_date: (customer.birth_date || profileDate(profile?.birth_date)).trim(),
    anniversary_date: (customer.anniversary_date || profileDate(profile?.anniversary_date)).trim(),
    country: (customer.country || profile?.country || '').trim(),
    state: (customer.state || profile?.state || '').trim(),
    district: (customer.district || profile?.district || '').trim(),
    city: (customer.city || profile?.city || '').trim(),
    postal_code: (customer.postal_code || profile?.postal_code || '').trim(),
    address_line_1: (customer.address_line_1 || profile?.address_line_1 || '').trim(),
    address_line_2: (customer.address_line_2 || profile?.address_line_2 || '').trim(),
  }

  if (!resolvedCustomer.first_name) return { error: 'First name is required.', status: 400 as const }
  if (!resolvedCustomer.last_name) return { error: 'Last name is required.', status: 400 as const }
  if (resolvedCustomer.first_name.length > 80) return { error: 'First name must be 80 characters or fewer.', status: 400 as const }
  if (resolvedCustomer.last_name.length > 80) return { error: 'Last name must be 80 characters or fewer.', status: 400 as const }
  if (!resolvedCustomer.email || !isValidEmail(resolvedCustomer.email)) {
    return { error: 'A valid email address is required.', status: 400 as const }
  }
  if (!resolvedCustomer.phone || !isValidPhone(resolvedCustomer.phone)) {
    return { error: 'A valid mobile number with country code is required.', status: 400 as const }
  }
  if (!resolvedCustomer.country) return { error: 'Country is required.', status: 400 as const }
  if (!resolvedCustomer.state) return { error: 'State, province, or region is required.', status: 400 as const }
  if (!resolvedCustomer.city) return { error: 'City is required.', status: 400 as const }
  if (!resolvedCustomer.postal_code || !isValidPostalCode(resolvedCustomer.postal_code)) {
    return { error: 'A valid postal code or pincode is required.', status: 400 as const }
  }
  if (!resolvedCustomer.address_line_1) {
    return { error: 'Address line 1 is required.', status: 400 as const }
  }
  const isValidOptionalDate = (value: string) => {
    if (!value) return true
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const parsed = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }
  if (!isValidOptionalDate(resolvedCustomer.birth_date) || (resolvedCustomer.birth_date && resolvedCustomer.birth_date > new Date().toISOString().slice(0, 10))) {
    return { error: 'Birth date must be a valid date that is not in the future.', status: 400 as const }
  }
  if (!isValidOptionalDate(resolvedCustomer.anniversary_date)) {
    return { error: 'Anniversary date must be a valid date.', status: 400 as const }
  }

  let chargeQuote: Awaited<ReturnType<typeof buildCheckoutChargeQuote>>
  try {
    chargeQuote = await buildCheckoutChargeQuote({
      subtotalUsd: subtotalAmount,
      gstUsd: gstAmount,
      couponDiscountUsd: couponDiscountAmount,
      country: resolvedCustomer.country,
      currencyCode: payload?.currencyCode || null,
    })
  } catch {
    return { error: 'Live exchange pricing is temporarily unavailable. Please try again shortly.', status: 503 as const }
  }

  return {
    data: {
      normalizedItems,
      subtotalAmount,
      gstAmount,
      gstLabel,
      gstPercentage,
      couponId,
      couponCode,
      couponDiscountAmount,
      couponRewardType,
      gift,
      totalAmount,
      loveLetter,
      chargeQuote,
      resolvedCustomer,
    } satisfies PreparedCheckout,
  } as const
}

export async function createPendingOrder({
  userId,
  customerIdentityId,
  guestTokenHash,
  payload,
  prepared,
  razorpayOrderId,
}: {
  userId: string | null
  customerIdentityId?: string | null
  guestTokenHash: string | null
  payload: CheckoutPayload
  prepared: PreparedCheckout
  razorpayOrderId: string
}) {

  requireF7WritePrepared()
  if (userId !== null || Boolean(customerIdentityId) === Boolean(guestTokenHash)) {
    throw new Error('Exactly one RDS checkout owner is required.')
  }
  const gatewayPayload = buildGatewayPayload({ payload, prepared, razorpayOrderId })
  const notes = [
    'Created from Razorpay checkout flow.',
    prepared.couponCode ? (prepared.couponRewardType === 'free_gift' ? `Gift coupon selected: ${prepared.couponCode}.` : `Coupon selected: ${prepared.couponCode} (-${prepared.couponDiscountAmount}).`) : null,
  ]
    .filter(Boolean)
    .join(' ')

  const orderInput = {
    user_id: userId,
    guest_token_hash: guestTokenHash,
    customer_email: prepared.resolvedCustomer.email,
    customer_first_name: prepared.resolvedCustomer.first_name || 'Customer',
    customer_last_name: prepared.resolvedCustomer.last_name,
    customer_phone: prepared.resolvedCustomer.phone,
    customer_birth_date: prepared.resolvedCustomer.birth_date || null,
    customer_anniversary_date: prepared.resolvedCustomer.anniversary_date || null,
    shipping_country: prepared.resolvedCustomer.country,
    shipping_state: prepared.resolvedCustomer.state,
    shipping_district: prepared.resolvedCustomer.district,
    shipping_city: prepared.resolvedCustomer.city,
    shipping_postal_code: prepared.resolvedCustomer.postal_code,
    shipping_address_line_1: prepared.resolvedCustomer.address_line_1,
    shipping_address_line_2: prepared.resolvedCustomer.address_line_2,
    subtotal_amount: prepared.subtotalAmount,
    gst_amount: prepared.gstAmount,
    shipping_amount: 0,
    total_amount: prepared.totalAmount,
    love_letter_included: Boolean(prepared.loveLetter?.wantsLetter),
    love_letter_type: prepared.loveLetter?.letterType || 'no_letter',
    status: 'pending',
    payment_status: 'pending',
    payment_gateway: 'razorpay',
    payment_currency: prepared.chargeQuote.chargeCurrency,
    payment_amount: prepared.chargeQuote.totalCharged,
    razorpay_order_id: razorpayOrderId,
    gateway_order_status: 'created',
    gateway_payment_status: 'pending',
    gateway_payload: gatewayPayload,
    notes,
  }
  const loveLetterInput = prepared.loveLetter
    ? {
      wants_letter: Boolean(prepared.loveLetter.wantsLetter),
      letter_type: prepared.loveLetter.letterType || 'no_letter',
      recipient_name: prepared.loveLetter.recipientName?.trim() || null,
      sender_name: prepared.loveLetter.senderName?.trim() || null,
      occasion_key: prepared.loveLetter.occasionKey || null,
      about_her_text: prepared.loveLetter.aboutHerText?.trim() || null,
      custom_letter_text: prepared.loveLetter.customLetterText?.trim() || null,
      final_letter_text: prepared.loveLetter.finalLetterText?.trim() || null,
      final_letter_html: prepared.loveLetter.finalLetterHtml?.trim() || null,
      print_status: prepared.loveLetter.wantsLetter ? 'pending' : 'skipped',
    }
    : null
  const itemInputs: Array<Record<string, unknown>> = prepared.normalizedItems.map(({ entry, product, quantity, unitPrice, subtotalAmount, gstSlabId, gstPercentage, gstAmount, selectedCustomDropdowns, productName, metalLabel, imageUrl }) => ({
    product_id: product?.id || null,
    product_name: productName,
    product_slug: product?.slug || entry.slug,
    sku: product?.sku || null,
    quantity,
    unit_price: unitPrice,
    line_total: subtotalAmount,
    selected_metal: metalLabel || buildSelectionLabel(entry.metal, entry.purity) || null,
    selected_purity: null,
    selected_size_or_fit: entry.sizeOrFit || null,
    selected_gemstone: entry.gemstone || null,
    selected_carat: entry.carat || null,
    gst_slab_id: gstSlabId,
    gst_percentage: gstPercentage,
    gst_amount: gstAmount,
    image_url: imageUrl || null,
    selected_custom_dropdowns: selectedCustomDropdowns,
    item_type: 'regular',
    promotion_coupon_id: null,
    original_unit_price: null,
    promotion_metadata: {},
  }))
  if (prepared.gift && prepared.couponId && prepared.couponCode) {
    itemInputs.push({
      product_id: prepared.gift.productId,
      product_name: prepared.gift.name,
      product_slug: prepared.gift.slug,
      sku: prepared.gift.sku,
      quantity: 1,
      unit_price: 0,
      line_total: 0,
      selected_metal: typeof prepared.gift.variantData.label === 'string' ? prepared.gift.variantData.label : null,
      selected_purity: null,
      selected_size_or_fit: null,
      selected_gemstone: null,
      selected_carat: null,
      gst_slab_id: null,
      gst_percentage: 0,
      gst_amount: 0,
      image_url: prepared.gift.imageUrl || null,
      selected_custom_dropdowns: [],
      item_type: 'free_gift',
      promotion_coupon_id: prepared.couponId,
      original_unit_price: prepared.gift.originalUnitPrice,
      promotion_metadata: { coupon_code: prepared.couponCode, reward_type: 'free_gift', variant: prepared.gift.variantData },
    })
  }

  const { data: order, error: orderError } = await (async () => {
    try {
      const order = await createRdsPendingOrder({
        order: { ...orderInput, customer_identity_id: customerIdentityId ?? null, fulfillment_mode: 'made_to_order' },
        items: itemInputs, loveLetter: loveLetterInput,
        birthDate: prepared.resolvedCustomer.birth_date || null,
        anniversaryDate: prepared.resolvedCustomer.anniversary_date || null,
      })
      return { data: order, error: null as { code?: string; message: string } | null }
    } catch {
      return { data: null, error: { message: 'Unable to create order.' } }
    }
  })()

  if (orderError || !order) {
    return { error: orderError?.message || 'Unable to create order.' }
  }

  return {
    data: {
      order: order as PendingOrderRecord,
      gatewayPayload,
    },
  } as const
}
