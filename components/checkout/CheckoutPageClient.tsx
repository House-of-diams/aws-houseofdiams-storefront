'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import CheckoutInformationStep from '@/components/checkout/CheckoutInformationStep';
import CheckoutConfirmationStep from '@/components/checkout/CheckoutConfirmationStep';
import CheckoutSummary from '@/components/checkout/CheckoutSummary';
import CheckoutDeliveryPreview from '@/components/checkout/CheckoutDeliveryPreview';
import AdditionalSummaryDetails from '@/components/common/AdditionalSummaryDetails';
import { GiftOfferBanner } from '@/components/commerce/GiftOfferBanner';
import type { StorefrontPromotion } from '@/components/commerce/PromotionBanner';
import type { CheckoutChargeQuote, CheckoutDisplayItem, CheckoutPostalAreaOption, CheckoutPostalLookupState, CheckoutProfileForm } from '@/components/checkout/types';
import { useCurrency } from '@/context/CurrencyContext';
import { getCollectionHref } from '@/lib/browse-context';
import { useCart } from '@/lib/hooks/useCart';
import { getProductKey, type CartProductSnapshot } from '@/lib/product-keys';
import type { StorefrontProduct } from '@/lib/catalog-products';
import { clearLoveLetterDraft, readLoveLetterDraft, type LoveLetterDraft } from '@/lib/love-letter';

const APPLIED_COUPON_KEY = 'hod_applied_coupon'
const REQUESTED_COUPON_KEY = 'hod_requested_coupon'
const GUEST_CHECKOUT_TOKEN_KEY = 'hod_guest_checkout_token'

type RazorpayCheckoutSuccess = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

function buildCheckoutRequestItem(item: CheckoutDisplayItem) {
  return {
    name: item.name,
    slug: item.slug,
    metalVariantId: item.metalVariantId,
    imageUrl: item.imageUrl,
    metal: item.metal,
    purity: item.purity,
    sizeOrFit: item.sizeOrFit,
    gemstone: item.gemstone,
    carat: item.carat,
    quantity: item.quantity,
    customSelections: item.customSelections,
  }
}

type RazorpayCheckoutFailure = {
  error?: {
    code?: string
    description?: string
    source?: string
    step?: string
    reason?: string
    metadata?: {
      order_id?: string
      payment_id?: string
    }
  }
}

type RazorpayCheckoutOptions = {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description?: string
  prefill?: {
    name?: string
    email?: string
    contact?: string
  }
  theme?: {
    color?: string
  }
  modal?: {
    ondismiss?: () => void
  }
  handler: (response: RazorpayCheckoutSuccess) => void | Promise<void>
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => {
      open: () => void
      on: (event: 'payment.failed', handler: (response: RazorpayCheckoutFailure) => void) => void
    }
  }
}

type PendingPaymentSession = {
  orderId: string
  orderNumber: string
  razorpay: {
    keyId: string
    orderId: string
    amount: number
    currency: string
    name: string
    description?: string
    prefill?: {
      name?: string
      email?: string
      contact?: string
    }
    baseCurrency?: string
    baseAmount?: number
    exchangeRate?: number
    exchangeRateSource?: string
  }
}

type PaymentUiStage = 'idle' | 'starting' | 'confirming'

type PostalLookupResponse = {
  areas?: CheckoutPostalAreaOption[]
  error?: string
}

const POSTAL_CODE_LOOKUP_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\s-]{2,11}$/

function normalizePostalCodeValue(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 12)
}

function isLookupReadyAfterTyping(postalCode: string) {
  return POSTAL_CODE_LOOKUP_PATTERN.test(normalizePostalCodeValue(postalCode))
}

function loadRazorpayCheckoutScript() {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.Razorpay) return Promise.resolve(true)

  return new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)), { once: true })
      existing.addEventListener('error', () => resolve(false), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.dataset.razorpayCheckout = 'true'
    script.onload = () => resolve(Boolean(window.Razorpay))
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

// Best-effort release of a prepared order the shopper will not pay (details changed
// before Pay). The server refuses to release anything that has a payment.
function releasePaymentSession(orderId: string, guestToken: string | null) {
  void fetch('/api/checkout/cancel', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(guestToken ? { 'x-guest-checkout-token': guestToken } : {}) },
    body: JSON.stringify({ orderId }),
    keepalive: true,
  }).catch(() => null)
}

function getOrCreateGuestCheckoutToken() {
  const existing = window.sessionStorage.getItem(GUEST_CHECKOUT_TOKEN_KEY)
  if (existing && /^[0-9a-f]{64}$/.test(existing)) return existing
  const bytes = new Uint8Array(32)
  window.crypto.getRandomValues(bytes)
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  window.sessionStorage.setItem(GUEST_CHECKOUT_TOKEN_KEY, token)
  return token
}
function parseCurrency(value: string | null) {
  const parsed = Number(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function isExplicitMinimumOrderCouponError(error: unknown) {
  return typeof error === 'string' && /^Add \$[\d,.]+ more to use this coupon\.$/i.test(error.trim())
}

const CHECKOUT_STEPS = [
  { id: 'shipping', label: 'Shipping' },
  { id: 'payment', label: 'Payment' },
] as const;

const EMPTY_PROFILE_FORM: CheckoutProfileForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  birth_date: '',
  anniversary_date: '',
  country: '',
  state: '',
  district: '',
  city: '',
  postal_code: '',
  address_line_1: '',
  address_line_2: '',
};

export default function CheckoutPageClient({ customerAuthEnabled = false }: { customerAuthEnabled?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { items: cartItems, clearCart, isHydrated: isCartHydrated } = useCart();
  const { currencyCode, format } = useCurrency();
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [guestCheckout, setGuestCheckout] = useState(false);
  const [customerForm, setCustomerForm] = useState<CheckoutProfileForm>(EMPTY_PROFILE_FORM);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentUiStage, setPaymentUiStage] = useState<PaymentUiStage>('idle')
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CheckoutProfileForm, string>>>({});
  const [taxInfo, setTaxInfo] = useState<{ gstLabel: string; gstPercentage: number } | null>(null);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: number
    code: string
    title: string
    discountType: 'percentage' | 'fixed'
    discountValue: number
    discountAmount: number
    rewardType?: 'percentage' | 'fixed' | 'free_gift'
    minimumOrderAmount?: number
    gift?: { productId: string; name: string; slug: string; sku: string | null; imageUrl: string; originalUnitPrice: number; variantData: Record<string, unknown> } | null
    bannerTitle?: string | null
    bannerDescription?: string | null
    bannerImageUrl?: string
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [giftPromotion, setGiftPromotion] = useState<StorefrontPromotion | null>(null)
  const [requestedCouponCode, setRequestedCouponCode] = useState('')
  const [requestedPromotion, setRequestedPromotion] = useState<StorefrontPromotion | null>(null)
  const [pendingPaymentSession, setPendingPaymentSession] = useState<PendingPaymentSession | null>(null)
  const [chargeQuote, setChargeQuote] = useState<CheckoutChargeQuote | null>(null)
  const [quoteStatus, setQuoteStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [quoteLoadingNotice, setQuoteLoadingNotice] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [authoritativePricing, setAuthoritativePricing] = useState<{
    subtotalAmount: number
    gstAmount: number
    couponDiscountAmount: number
    totalAmount: number
    lines: Array<{ slug: string; unitPrice: number; quantity: number }>
    gift?: { productId: string; name: string; slug: string; sku: string | null; imageUrl: string; originalUnitPrice: number; variantData: Record<string, unknown> } | null
  } | null>(null)
  const quoteCacheRef = useRef(new Map<string, { expiresAt: number; quote: CheckoutChargeQuote; pricing: typeof authoritativePricing }>())
  const [postalLookup, setPostalLookup] = useState<CheckoutPostalLookupState | null>(null)
  const [postalAreaOptions, setPostalAreaOptions] = useState<CheckoutPostalAreaOption[]>([])
  const [cartProducts, setCartProducts] = useState<CartProductSnapshot[]>([]);
  const [taxMap, setTaxMap] = useState<Record<string, { gstLabel: string; gstPercentage: number }>>({});
  const lastPostalAutofillRef = useRef<{
    country: string
    postalCode: string
    city: string
    district: string
    state: string
  } | null>(null)
  const postalLookupAbortRef = useRef<AbortController | null>(null)
  const checkoutAttemptKeyRef = useRef<string | null>(null)
  const paymentSessionPromiseRef = useRef<Promise<PendingPaymentSession | null> | null>(null)
  const pendingPaymentSessionRef = useRef<PendingPaymentSession | null>(null)
  const paymentSessionSignatureRef = useRef('')
  const paymentCustomerSessionRef = useRef(false)
  const paymentGuestTokenRef = useRef<string | null>(null)
  const lastPostalLookupKeyRef = useRef<string>('')
  const requestedCouponAttemptRef = useRef<string | null>(null)
  const restoredAppliedCouponCodeRef = useRef<string | null>(null)
  const cartMode = searchParams.get('mode') === 'cart';
  const directGiftCouponCode = cartMode ? '' : searchParams.get('gift_coupon')?.trim().toUpperCase() || ''

  useEffect(() => {
    if (!cartMode) {
      setAppliedCoupon(null)
      setCouponCodeInput('')
      setRequestedCouponCode('')
      setRequestedPromotion(null)
      return
    }
    try {
      const stored = localStorage.getItem(APPLIED_COUPON_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setAppliedCoupon(parsed)
        setCouponCodeInput(parsed.code || '')
        restoredAppliedCouponCodeRef.current = parsed.code || null
      }
      const requested = localStorage.getItem(REQUESTED_COUPON_KEY)?.trim().toUpperCase()
      if (requested) setRequestedCouponCode(requested)
    } catch { }
  }, [cartMode])

  useEffect(() => {
    void fetch('/api/public/promotions').then((response) => response.json()).then((payload) => {
      const items = Array.isArray(payload?.items) ? payload.items : []
      const promotion = items.find((item: { rewardType?: string }) => item.rewardType === 'free_gift') ?? null
      if (promotion) setGiftPromotion(promotion)
      const requested = items.find((item: { code?: string }) => item.code === localStorage.getItem(REQUESTED_COUPON_KEY)?.trim().toUpperCase()) ?? null
      if (requested) {
        setRequestedPromotion(requested)
      }
    }).catch(() => { })
  }, [])

  const singleItem = useMemo<CheckoutDisplayItem>(() => ({
    name: searchParams.get('name') ?? 'Selected Piece',
    slug: searchParams.get('slug') ?? '',
    metalVariantId: searchParams.get('variant') ?? undefined,
    imageUrl: searchParams.get('image') ?? undefined,
    priceFrom: parseCurrency(searchParams.get('price')),
    metal: searchParams.get('metal') ?? '',
    purity: searchParams.get('purity') ?? '',
    sizeOrFit: searchParams.get('size') ?? '',
    gemstone: searchParams.get('gemstone') ?? '',
    carat: searchParams.get('carat') ?? '',
    customSelections: (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('custom') || '[]')) } catch { return [] } })(),
    quantity: 1,
    gstLabel: taxInfo?.gstLabel ?? '',
    gstPercentage: taxInfo?.gstPercentage ?? 0,
  }), [searchParams, taxInfo]);

  useEffect(() => {
    if (!cartMode || !isCartHydrated) return;
    const legacy = cartItems.filter((item) => !item.snapshot)
    if (!legacy.length) { setCartProducts([]); return }
    let ignore = false;
    void (async () => {
      const response = await fetch('/api/public/products/cart', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slugs: legacy.map((item) => item.productSlug).filter(Boolean), ids: legacy.map((item) => item.productKey).filter(Boolean) }) });
      const payload = await response.json().catch(() => null);
      if (!ignore && response.ok && Array.isArray(payload?.items)) {
        setCartProducts(payload.items);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [cartItems, cartMode, isCartHydrated]);

  const resolvedCartItems = useMemo(() => {
    if (!cartMode) return [];
    return cartItems
      .map((entry) => {
        const product = entry.snapshot || cartProducts.find((candidate) => getProductKey(candidate) === entry.productKey || candidate.slug === entry.productSlug);
        if (!product) return null;
        return { entry, product };
      })
      .filter(Boolean) as Array<{ entry: typeof cartItems[number]; product: typeof cartProducts[number] }>;
  }, [cartItems, cartMode, cartProducts]);
  const unavailableCartItemCount = cartMode ? Math.max(0, cartItems.length - resolvedCartItems.length) : 0

  const cartCheckoutItems = useMemo<CheckoutDisplayItem[]>(() => {
    if (!cartMode) return [];
    return resolvedCartItems
      .map(({ entry, product }) => {
        const tax = taxMap[product.slug];
        return {
          name: product.name,
          slug: product.slug,
          metalVariantId: entry.selection.metalVariantId,
          imageUrl: entry.selection.resolvedImageUrl || product.imageUrl || undefined,
          priceFrom: entry.selection.resolvedPrice ?? product.priceFrom,
          metal: entry.selection.metal ?? '',
          purity: entry.selection.purity ?? '',
          sizeOrFit: entry.selection.ringSize || entry.selection.sizeOrFit || '',
          gemstone: entry.selection.gemstone ?? '',
          carat: entry.selection.hiphopCarat ?? '',
          customSelections: entry.selection.customSelections ?? [],
          quantity: entry.quantity,
          gstLabel: tax?.gstLabel ?? 'Taxes',
          gstPercentage: tax?.gstPercentage ?? 0,
        };
      })
      .filter(Boolean) as CheckoutDisplayItem[];
  }, [cartMode, resolvedCartItems, taxMap]);

  const cartModeLoveLetterDraft = useMemo<LoveLetterDraft | null>(() => {
    if (!cartMode || resolvedCartItems.length !== 1) return null
    return resolvedCartItems[0]?.entry.selection.loveLetter ?? null
  }, [cartMode, resolvedCartItems])

  const loveLetterDraft = useMemo<LoveLetterDraft | null>(() => {
    if (cartMode) return cartModeLoveLetterDraft
    const draft = readLoveLetterDraft()
    if (!draft) return null
    if (draft.sourceSlug && draft.sourceSlug !== singleItem.slug) return null
    return draft
  }, [cartMode, cartModeLoveLetterDraft, singleItem.slug])

  const checkoutItems = useMemo(
    () =>
      cartMode
        ? cartCheckoutItems
        : singleItem.slug
          ? [
            {
              ...singleItem,
              gstLabel: taxInfo?.gstLabel ?? singleItem.gstLabel ?? 'Taxes',
              gstPercentage: taxInfo?.gstPercentage ?? singleItem.gstPercentage ?? 0,
            },
          ]
          : [],
    [cartMode, cartCheckoutItems, singleItem, taxInfo]
  );

  const displayedSubtotal = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + (item.priceFrom * item.quantity), 0),
    [checkoutItems]
  );
  const displayedCouponDiscount = appliedCoupon?.discountAmount ?? 0
  const displayedGstTotal = useMemo(
    () => checkoutItems.reduce((sum, item) => {
      const lineSubtotal = item.priceFrom * item.quantity
      const discountShare = displayedSubtotal > 0 ? displayedCouponDiscount * (lineSubtotal / displayedSubtotal) : 0
      const taxableLineAmount = Math.max(0, lineSubtotal - discountShare)
      return sum + (taxableLineAmount * ((item.gstPercentage ?? 0) / 100))
    }, 0),
    [checkoutItems, displayedCouponDiscount, displayedSubtotal]
  )
  const subtotal = authoritativePricing?.subtotalAmount ?? displayedSubtotal
  const couponDiscount = authoritativePricing?.couponDiscountAmount ?? displayedCouponDiscount
  const gstTotal = authoritativePricing?.gstAmount ?? displayedGstTotal
  const totalPayable = authoritativePricing?.totalAmount ?? Math.max(0, subtotal - couponDiscount) + gstTotal
  const authoritativeCheckoutItems = useMemo(
    () => checkoutItems.map((item, index) => ({
      ...item,
      priceFrom: authoritativePricing?.lines[index]?.unitPrice ?? item.priceFrom,
    })),
    [authoritativePricing?.lines, checkoutItems]
  )
  const hasAuthoritativePriceChange = useMemo(
    () => Boolean(authoritativePricing?.lines.some((line, index) => Math.abs(line.unitPrice - Number(checkoutItems[index]?.priceFrom || 0)) >= 0.01)),
    [authoritativePricing?.lines, checkoutItems]
  )
  const checkoutGiftPromotion = useMemo<StorefrontPromotion | null>(() => {
    if (appliedCoupon?.rewardType === 'free_gift' && appliedCoupon.gift) {
      return {
        id: appliedCoupon.id,
        code: appliedCoupon.code,
        title: appliedCoupon.title,
        rewardType: 'free_gift',
        discountValue: appliedCoupon.discountValue,
        minimumOrderAmount: Number(appliedCoupon.minimumOrderAmount ?? 0),
        bannerTitle: appliedCoupon.bannerTitle,
        bannerDescription: appliedCoupon.bannerDescription,
        bannerImageUrl: appliedCoupon.bannerImageUrl,
        gift: {
          name: appliedCoupon.gift.name,
          slug: appliedCoupon.gift.slug,
          sku: appliedCoupon.gift.sku,
          imageUrl: appliedCoupon.gift.imageUrl,
        },
      }
    }
    if (cartMode && requestedCouponCode && requestedPromotion?.rewardType === 'free_gift') return requestedPromotion
    return giftPromotion?.rewardType === 'free_gift' ? giftPromotion : null
  }, [appliedCoupon, cartMode, giftPromotion, requestedCouponCode, requestedPromotion])

  const hasAppliedGift = Boolean(
    appliedCoupon?.rewardType === 'free_gift' && (authoritativePricing?.gift || appliedCoupon.gift),
  )

  const paymentSessionSignature = useMemo(
    () =>
      JSON.stringify({
        items: checkoutItems,
        customerForm,
        couponId: appliedCoupon?.id ?? null,
        couponAmount: appliedCoupon?.discountAmount ?? 0,
        loveLetter: loveLetterDraft,
        currencyCode,
      }),
    [appliedCoupon?.discountAmount, appliedCoupon?.id, checkoutItems, currencyCode, customerForm, loveLetterDraft]
  )

  useEffect(() => {
    let ignore = false
    void (async () => {
      const ready = await loadRazorpayCheckoutScript()
      if (!ignore) setRazorpayReady(ready)
    })()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    paymentSessionSignatureRef.current = paymentSessionSignature
    // A prepared order no longer matches the cart, address, coupon or currency:
    // release it so its stock hold and gateway order do not linger.
    const stale = pendingPaymentSessionRef.current
    if (stale) releasePaymentSession(stale.orderId, paymentGuestTokenRef.current)
    pendingPaymentSessionRef.current = null
    setPendingPaymentSession(null)
    paymentSessionPromiseRef.current = null
    checkoutAttemptKeyRef.current = null
  }, [paymentSessionSignature])

  useEffect(() => {
    let ignore = false
    const controller = new AbortController()
    if (!checkoutItems.length) return
    if (!currencyCode && !customerForm.country.trim()) {
      setChargeQuote(null)
      setAuthoritativePricing(null)
      setQuoteStatus('idle')
      setQuoteLoadingNotice(false)
      setQuoteError('')
      return
    }

    const requestBody = {
      country: customerForm.country,
      currencyCode,
      coupon: appliedCoupon ? { id: appliedCoupon.id, code: appliedCoupon.code } : null,
      items: checkoutItems.map((item) => ({
        slug: item.slug,
        name: item.name,
        metalVariantId: item.metalVariantId,
        metal: item.metal,
        purity: item.purity,
        quantity: item.quantity,
      })),
    }
    const requestKey = JSON.stringify(requestBody)
    const cachedQuote = quoteCacheRef.current.get(requestKey)
    if (cachedQuote && cachedQuote.expiresAt > Date.now()) {
      setChargeQuote(cachedQuote.quote)
      setAuthoritativePricing(cachedQuote.pricing)
      setQuoteStatus('ready')
      setQuoteLoadingNotice(false)
      setQuoteError('')
      return () => controller.abort()
    }

    setQuoteStatus('loading')
    setQuoteLoadingNotice(false)
    const loadingNoticeTimer = window.setTimeout(() => {
      if (!ignore) setQuoteLoadingNotice(true)
    }, 450)
    const requestTimer = window.setTimeout(() => {
      setQuoteError('')
      void (async () => {
        try {
          const response = await fetch('/api/checkout/quote', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          })
          const payload = await response.json().catch(() => null)
          window.clearTimeout(loadingNoticeTimer)
          setQuoteLoadingNotice(false)
          if (!ignore && response.ok) {
            setChargeQuote(payload?.quote ?? null)
            setAuthoritativePricing(payload?.pricing ?? null)
            setQuoteStatus(payload?.quote && payload?.pricing ? 'ready' : 'error')
            setQuoteError(payload?.quote && payload?.pricing ? '' : 'We could not confirm the latest checkout total.')
            if (payload?.quote && payload?.pricing) {
              quoteCacheRef.current.set(requestKey, { expiresAt: Date.now() + 15_000, quote: payload.quote, pricing: payload.pricing })
            }
          } else if (!ignore) {
            setChargeQuote(null)
            setAuthoritativePricing(null)
            setQuoteStatus('error')
            setQuoteError(response.status >= 500 ? 'We could not confirm pricing right now. Please try again shortly.' : payload?.error || 'One or more products need your attention before checkout.')
            if (appliedCoupon && response.status < 500) {
              const minimumOrderAmount = Number(appliedCoupon.minimumOrderAmount ?? 0)
              setAppliedCoupon(null)
              if (cartMode && minimumOrderAmount > 0 && isExplicitMinimumOrderCouponError(payload?.error)) {
                setRequestedCouponCode(appliedCoupon.code)
                localStorage.setItem(REQUESTED_COUPON_KEY, appliedCoupon.code)
                localStorage.removeItem(APPLIED_COUPON_KEY)
                setCouponCodeInput('')
                setErrorMessage('')
              } else {
                setCouponCodeInput('')
                if (cartMode) {
                  localStorage.removeItem(APPLIED_COUPON_KEY)
                  localStorage.removeItem(REQUESTED_COUPON_KEY)
                  setRequestedCouponCode('')
                  setRequestedPromotion(null)
                }
                setErrorMessage(payload?.error || 'This coupon is not valid for the current checkout.')
              }
            }
          }
        } catch {
          if (controller.signal.aborted) return
          window.clearTimeout(loadingNoticeTimer)
          setQuoteLoadingNotice(false)
          if (!ignore) {
            setChargeQuote(null)
            setAuthoritativePricing(null)
            setQuoteStatus('error')
            setQuoteError('We could not confirm pricing right now. Check your connection and try again.')
          }
        }
      })()
    }, 180)

    return () => {
      ignore = true
      window.clearTimeout(loadingNoticeTimer)
      window.clearTimeout(requestTimer)
      controller.abort()
    }
  }, [appliedCoupon, cartMode, checkoutItems, currencyCode, customerForm.country])

  const setPostalCodeFieldError = useCallback((message?: string) => {
    setFieldErrors((current) => {
      if (!message) {
        if (!current.postal_code) return current
        const next = { ...current }
        delete next.postal_code
        return next
      }

      if (current.postal_code === message) return current
      return { ...current, postal_code: message }
    })
  }, [])

  const applyPostalArea = useCallback((area: CheckoutPostalAreaOption, postalCode: string) => {
    setCustomerForm((current) => ({
      ...current,
      city: area.city,
      district: area.district,
      state: area.state,
      country: area.country,
    }))

    setFieldErrors((current) => {
      const next = { ...current }
      delete next.city
      delete next.district
      delete next.state
      delete next.country
      delete next.postal_code
      return next
    })

    lastPostalAutofillRef.current = {
      country: area.country,
      postalCode,
      city: area.city,
      district: area.district,
      state: area.state,
    }

    setPostalLookup({
      status: 'success',
      message: 'Location filled from postal code.',
      city: area.city || undefined,
      district: area.district || undefined,
      state: area.state || undefined,
      country: area.country || undefined,
      countryCode: area.country === 'India' ? 'IN' : undefined,
      locked: true,
    })
  }, [])

  const lookupPostalCode = useCallback(
    async (postalCode: string) => {
      const normalizedPostalCode = normalizePostalCodeValue(postalCode)
      const selectedCountry = customerForm.country.trim()
      const lookupKey = `${selectedCountry.toUpperCase()}:${normalizedPostalCode.toUpperCase()}`

      if (!normalizedPostalCode || normalizedPostalCode.length < 3) {
        setPostalLookup(null)
        setPostalAreaOptions([])
        setPostalCodeFieldError()
        lastPostalLookupKeyRef.current = ''
        return
      }

      if (!POSTAL_CODE_LOOKUP_PATTERN.test(normalizedPostalCode)) {
        setPostalLookup({
          status: 'error',
          message: 'Invalid postal code, please check',
        })
        setPostalAreaOptions([])
        setPostalCodeFieldError('Invalid postal code, please check')
        return
      }

      if (lastPostalLookupKeyRef.current === lookupKey) {
        return
      }

      postalLookupAbortRef.current?.abort()
      const controller = new AbortController()
      postalLookupAbortRef.current = controller

      setPostalLookup({
        status: 'loading',
        message: 'Looking up city, district, state, and country...',
      })
      setPostalAreaOptions([])
      setCustomerForm((current) => ({
        ...current,
        city: '',
        district: '',
        state: '',
      }))
      setPostalCodeFieldError()

      try {
        const response = await fetch(
          `/api/checkout/postal-lookup?postalCode=${encodeURIComponent(normalizedPostalCode)}${selectedCountry ? `&country=${encodeURIComponent(selectedCountry)}` : ''}`,
          {
            cache: 'no-store',
            signal: controller.signal,
            method: 'GET',
            headers: { accept: 'application/json' },
          }
        )
        const payload = (await response.json().catch(() => null)) as PostalLookupResponse | null

        if (!response.ok) {
          throw new Error(payload?.error || 'Network error')
        }

        const areas = Array.isArray(payload?.areas) ? payload.areas : []

        if (!areas.length) {
          const message = 'Invalid postal code, please check'
          setPostalLookup({
            status: 'error',
            message,
          })
          setPostalAreaOptions([])
          setPostalCodeFieldError(message)
          return
        }

        setPostalAreaOptions(areas)
        applyPostalArea(areas[0], normalizedPostalCode)
        lastPostalLookupKeyRef.current = `${areas[0].country.trim().toUpperCase()}:${normalizedPostalCode.toUpperCase()}`
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Postal lookup failed:', error)
        const message = error instanceof Error && error.message
          ? error.message
          : 'Could not fetch location, try again'
        setPostalLookup({
          status: 'error',
          message,
        })
        setPostalAreaOptions([])
        setPostalCodeFieldError(message)
      } finally {
        if (postalLookupAbortRef.current === controller) {
          postalLookupAbortRef.current = null
        }
      }
    },
    [applyPostalArea, customerForm.country, setPostalCodeFieldError]
  )

  const handlePostalCodeBlur = useCallback(() => {
    const postalCode = normalizePostalCodeValue(customerForm.postal_code)

    if (!postalCode) {
      setPostalLookup(null)
      setPostalAreaOptions([])
      setPostalCodeFieldError()
      return
    }

    if (isLookupReadyAfterTyping(postalCode)) {
      void lookupPostalCode(postalCode)
    }
  }, [customerForm.postal_code, lookupPostalCode, setPostalCodeFieldError])

  useEffect(() => {
    const postalCode = normalizePostalCodeValue(customerForm.postal_code)

    if (!postalCode || postalCode.length < 3) {
      postalLookupAbortRef.current?.abort()
      lastPostalLookupKeyRef.current = ''
      setPostalLookup(null)
      setPostalAreaOptions([])
      setPostalCodeFieldError()
      lastPostalAutofillRef.current = null
      if (customerForm.city || customerForm.district || customerForm.state || customerForm.country) {
        setCustomerForm((current) => ({
          ...current,
          city: '',
          district: '',
          state: '',
          country: '',
        }))
      }
      return
    }

    if (!isLookupReadyAfterTyping(postalCode)) {
      postalLookupAbortRef.current?.abort()
      setPostalLookup(null)
      return
    }

    const timeoutId = window.setTimeout(() => {
      void lookupPostalCode(postalCode)
    }, 400)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [customerForm.city, customerForm.country, customerForm.district, customerForm.postal_code, customerForm.state, lookupPostalCode, setPostalCodeFieldError])

  useEffect(() => {
    if (cartMode || !singleItem.slug) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/checkout/tax?slug=${encodeURIComponent(singleItem.slug)}`, {
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (response.ok) {
          setTaxInfo({
            gstLabel: payload?.gstLabel ?? 'Taxes',
            gstPercentage: Number(payload?.gstPercentage ?? 0),
          });
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Unable to load product tax information:', error);
        }
      }
    })();
    return () => controller.abort();
  }, [cartMode, singleItem.slug]);

  useEffect(() => {
    if (!cartMode || !resolvedCartItems.length) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const slugs = [...new Set(resolvedCartItems.map(({ product }) => product.slug))];
        const response = await fetch('/api/checkout/tax', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ slugs }),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (response.ok) {
          setTaxMap(payload?.taxBySlug ?? {});
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Unable to load cart tax information:', error);
        }
      }
    })();
    return () => controller.abort();
  }, [cartMode, resolvedCartItems]);

  useEffect(() => {
    void (async () => {
      const customerSession = customerAuthEnabled
        ? await fetch('/api/customer-auth/session', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).catch(() => null)
        : null;
      const hasCustomerSession = customerSession?.authenticated === true && customerSession?.identity?.emailVerified === true;
      if (!hasCustomerSession) {
        setSessionReady(false);
        setSessionLoading(false);
        return;
      }

      const sessionUser = customerSession?.identity;
      setCustomerForm((current) => ({
        ...current,
        email: current.email || sessionUser?.email || '',
      }));
      setSessionReady(true);
      setSessionLoading(false);

      try {
        const response = await fetch('/api/checkout/profile', {
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          setErrorMessage(payload?.error ?? 'Profile could not be prefilled, but you can enter checkout details manually.');
          return;
        }

        const nextProfile = payload?.profile ?? null;
        setCustomerForm((current) => ({
          ...current,
          first_name: current.first_name || nextProfile?.first_name || '',
          last_name: current.last_name || nextProfile?.last_name || '',
          email: current.email || nextProfile?.email || sessionUser?.email || '',
          phone: current.phone || nextProfile?.phone || '',
          birth_date: current.birth_date || nextProfile?.birth_date || '',
          anniversary_date: current.anniversary_date || nextProfile?.anniversary_date || '',
          country: current.country || nextProfile?.country || '',
          state: current.state || nextProfile?.state || '',
          district: current.district || nextProfile?.district || '',
          city: current.city || nextProfile?.city || '',
          postal_code: current.postal_code || nextProfile?.postal_code || '',
          address_line_1: current.address_line_1 || nextProfile?.address_line_1 || '',
          address_line_2: current.address_line_2 || nextProfile?.address_line_2 || '',
        }));
      } catch {
        setErrorMessage('Profile could not be prefilled, but you can enter checkout details manually.');
      }
    })();
  }, [customerAuthEnabled]);
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === CHECKOUT_STEPS.length - 1;
  const continueHref = getCollectionHref(searchParams.get('category'));

  const patchCustomerForm = (patch: Partial<CheckoutProfileForm>) => {
    setCustomerForm((current) => ({ ...current, ...patch }))
    setFieldErrors((current) => {
      const next = { ...current }
      let changed = false

      for (const key of Object.keys(patch) as Array<keyof CheckoutProfileForm>) {
        if (!current[key]) continue
        delete next[key]
        changed = true
      }

      if (!changed) return current
      return next
    })
  }

  const updateCustomerForm = (field: keyof CheckoutProfileForm, value: string) => {
    patchCustomerForm({ [field]: value })
  };

  const handlePostalAreaSelect = useCallback(
    (id: string) => {
      const postalCode = normalizePostalCodeValue(customerForm.postal_code)
      const area = postalAreaOptions.find((option) => option.id === id)
      if (area) applyPostalArea(area, postalCode)
    },
    [applyPostalArea, customerForm.postal_code, postalAreaOptions]
  )

  const validateCheckoutForm = () => {
    const nextErrors: Partial<Record<keyof CheckoutProfileForm, string>> = {}
    const trimmed = {
      first_name: customerForm.first_name.trim(),
      last_name: customerForm.last_name.trim(),
      email: customerForm.email.trim(),
      phone: customerForm.phone.trim(),
      birth_date: customerForm.birth_date.trim(),
      anniversary_date: customerForm.anniversary_date.trim(),
      country: customerForm.country.trim(),
      state: customerForm.state.trim(),
      district: customerForm.district.trim(),
      city: customerForm.city.trim(),
      postal_code: customerForm.postal_code.trim(),
      address_line_1: customerForm.address_line_1.trim(),
      address_line_2: customerForm.address_line_2.trim(),
    }

    if (!trimmed.first_name) nextErrors.first_name = 'First name is required.'
    if (!trimmed.last_name) nextErrors.last_name = 'Last name is required.'
    if (!trimmed.email) {
      nextErrors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.email)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    const digitsOnlyPhone = trimmed.phone.replace(/[^\d+]/g, '')
    if (!trimmed.phone) {
      nextErrors.phone = 'Mobile number is required.'
    } else if (!/^\+?[0-9][0-9\s\-()]{7,19}$/.test(trimmed.phone) || digitsOnlyPhone.replace(/\D/g, '').length < 8) {
      nextErrors.phone = 'Enter a valid mobile number with country code.'
    }

    if (!trimmed.country) nextErrors.country = 'Country is required.'
    if (!trimmed.state) nextErrors.state = 'State, province, or region is required.'
    if (!trimmed.city) nextErrors.city = 'City is required.'
    if (!trimmed.postal_code) {
      nextErrors.postal_code = 'Postal code or pincode is required.'
    } else if (!/^[A-Za-z0-9][A-Za-z0-9\s-]{2,11}$/.test(trimmed.postal_code)) {
      nextErrors.postal_code = 'Enter a valid postal code or pincode.'
    }
    if (!trimmed.address_line_1) nextErrors.address_line_1 = 'Address line 1 is required.'
    if (trimmed.birth_date && (trimmed.birth_date > new Date().toISOString().slice(0, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed.birth_date))) nextErrors.birth_date = 'Enter a valid birth date.'
    if (trimmed.anniversary_date && !/^\d{4}-\d{2}-\d{2}$/.test(trimmed.anniversary_date)) nextErrors.anniversary_date = 'Enter a valid anniversary date.'

    return nextErrors
  }

  const validateFieldsForStep = (stepIndex: number) => {
    const allErrors = validateCheckoutForm()
    const keysForStep: Array<keyof CheckoutProfileForm> =
      stepIndex === 0
        ? ['first_name', 'last_name', 'email', 'phone', 'birth_date', 'anniversary_date', 'country', 'state', 'city', 'postal_code', 'address_line_1']
        : []

    const stepErrors = keysForStep.reduce<Partial<Record<keyof CheckoutProfileForm, string>>>((acc, key) => {
      if (allErrors[key]) acc[key] = allErrors[key]
      return acc
    }, {})

    setFieldErrors((current) => ({ ...current, ...stepErrors }))
    return stepErrors
  }

  const handleNextStep = () => {
    const stepErrors = validateFieldsForStep(currentStep)
    if (Object.keys(stepErrors).length > 0) {
      setErrorMessage('Please complete the required checkout details before continuing.')
      return
    }

    setErrorMessage('')
    setCurrentStep((step) => Math.min(CHECKOUT_STEPS.length - 1, step + 1))
    // The order, gateway order and stock hold are created only when the shopper
    // presses Pay (handlePayNow), not on reaching the review step.
  }

  const preparePaymentSession = async (showErrors: boolean) => {
    if (pendingPaymentSession) return pendingPaymentSession
    if (paymentSessionPromiseRef.current) return paymentSessionPromiseRef.current

    const request = (async () => {
      const requestSignature = paymentSessionSignatureRef.current
      const session = customerAuthEnabled
        ? await fetch('/api/customer-auth/session', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).catch(() => null)
        : null
      const hasCustomerSession = session?.authenticated === true && session?.identity?.emailVerified === true
      const guestToken = hasCustomerSession ? null : (guestCheckout ? getOrCreateGuestCheckoutToken() : null)
      if (!hasCustomerSession && !guestToken) {
        if (showErrors) setErrorMessage('Choose Express Checkout or sign in to continue.')
        return null
      }
      paymentCustomerSessionRef.current = hasCustomerSession
      paymentGuestTokenRef.current = guestToken

      const idempotencyKey = checkoutAttemptKeyRef.current || window.crypto.randomUUID()
      checkoutAttemptKeyRef.current = idempotencyKey
      const response = await fetch('/api/checkout/place', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(guestToken ? { 'x-guest-checkout-token': guestToken } : {}),
        },
        body: JSON.stringify({
          idempotencyKey,
          item: cartMode ? null : buildCheckoutRequestItem(singleItem),
          items: cartMode ? checkoutItems.map(buildCheckoutRequestItem) : undefined,
          customer: customerForm,
          loveLetter: loveLetterDraft,
          currencyCode,
          coupon: appliedCoupon
            ? {
              id: appliedCoupon.id,
              code: appliedCoupon.code,
            }
            : null,
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        if (payload?.retryable) checkoutAttemptKeyRef.current = null
        if (showErrors) setErrorMessage(payload?.error ?? 'Unable to start payment.')
        return null
      }

      const nextSession = payload as PendingPaymentSession
      if (paymentSessionSignatureRef.current !== requestSignature) {
        // Cart, address, coupon or currency changed while the order was being
        // created; never open payment for the outdated order.
        releasePaymentSession(nextSession.orderId, guestToken)
        checkoutAttemptKeyRef.current = null
        if (showErrors) setErrorMessage('Your checkout details changed while payment was starting. Please press Pay again.')
        return null
      }
      pendingPaymentSessionRef.current = nextSession
      setPendingPaymentSession(nextSession)
      return nextSession
    })()

    paymentSessionPromiseRef.current = request
    try {
      return await request
    } finally {
      paymentSessionPromiseRef.current = null
    }
  }

  const handlePayNow = async () => {
    const allErrors = validateCheckoutForm()
    setFieldErrors(allErrors)
    if (Object.keys(allErrors).length > 0) {
      setErrorMessage('Please complete all required customer and shipping details before continuing to payment.')
      return
    }

    if (unavailableCartItemCount > 0) {
      setErrorMessage('One or more cart items are no longer available. Return to your cart to remove or reconfigure them.')
      return
    }

    if (quoteStatus !== 'ready' || !chargeQuote || !authoritativePricing) {
      setErrorMessage(quoteError || 'Please wait while we confirm the latest price and availability.')
      return
    }

    if (!razorpayReady || !window.Razorpay) {
      setErrorMessage('Razorpay checkout is still loading. Please try again in a moment.')
      return
    }

    setProcessingPayment(true);
    setPaymentUiStage('starting')
    setErrorMessage('');
    let popupOpened = false
    try {
      const paymentSession = await preparePaymentSession(true)
      const guestToken = paymentGuestTokenRef.current

      if ((!guestToken && !paymentCustomerSessionRef.current) || !paymentSession) {
        setPaymentUiStage('idle')
        setProcessingPayment(false)
        return
      }

      let paymentHandlerStarted = false
      const razorpayInstance = new window.Razorpay({
        key: paymentSession.razorpay.keyId,
        order_id: paymentSession.razorpay.orderId,
        amount: paymentSession.razorpay.amount,
        currency: paymentSession.razorpay.currency,
        name: paymentSession.razorpay.name,
        description: paymentSession.razorpay.description,
        prefill: paymentSession.razorpay.prefill,
        theme: {
          color: '#101828',
        },
        modal: {
          ondismiss: async () => {
            // Give Razorpay's success callback a brief chance to win the modal-close race.
            await new Promise((resolve) => window.setTimeout(resolve, 750))
            if (paymentHandlerStarted) return

            const cancellationResponse = await fetch('/api/checkout/cancel', {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                ...(guestToken ? { 'x-guest-checkout-token': guestToken } : {}),
              },
              body: JSON.stringify({ orderId: paymentSession.orderId }),
              keepalive: true,
            }).catch(() => null)
            const cancellationPayload = cancellationResponse
              ? await cancellationResponse.json().catch(() => null)
              : null

            if (paymentHandlerStarted) return

            pendingPaymentSessionRef.current = null
            setPendingPaymentSession(null)
            paymentSessionPromiseRef.current = null
            setPaymentUiStage('idle')
            setProcessingPayment(false)
            if (
              !cancellationResponse?.ok ||
              cancellationPayload?.releaseDenied === true ||
              cancellationPayload?.released !== true
            ) {
              setErrorMessage("We're confirming your payment status — please check your orders page before trying again.")
              return
            }

            checkoutAttemptKeyRef.current = null
            setErrorMessage('Payment popup closed. You can try again.')
          },
        },
        handler: async (paymentResponse) => {
          paymentHandlerStarted = true
          setProcessingPayment(true)
          setPaymentUiStage('confirming')
          const verifyResponse = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(guestToken ? { 'x-guest-checkout-token': guestToken } : {}),
            },
            body: JSON.stringify({
              orderId: paymentSession.orderId,
              orderNumber: paymentSession.orderNumber,
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
            }),
          })

          const verifyPayload = await verifyResponse.json().catch(() => null)
          if (!verifyResponse.ok) {
            setPaymentUiStage('idle')
            setProcessingPayment(false)
            setErrorMessage(verifyPayload?.error ?? 'Payment verification failed. Please contact support if the amount was deducted.')
            return
          }

          // Forget the paid session before clearing the cart, so the cart change
          // is not treated as an outdated order to release.
          pendingPaymentSessionRef.current = null
          setPendingPaymentSession(null)
          if (cartMode) {
            clearCart()
          }
          clearLoveLetterDraft()
          router.replace(`/checkout/success?order=${encodeURIComponent(verifyPayload.orderNumber || paymentSession.orderNumber)}`)
        },
      })

      razorpayInstance.on('payment.failed', (failure) => {
        setPaymentUiStage('idle')
        setProcessingPayment(false)
        setErrorMessage(failure.error?.description || 'Payment failed. You can try again from this checkout.')
      })

      popupOpened = true
      razorpayInstance.open()
      setPaymentUiStage('idle')
      setProcessingPayment(false)
    } catch (error) {
      console.error('Unable to start Razorpay checkout:', error)
      setPaymentUiStage('idle')
      setErrorMessage('Unable to open Razorpay checkout right now. Please try again.')
    } finally {
      if (!popupOpened) {
        setPaymentUiStage('idle')
        setProcessingPayment(false)
      }
    }
  };

  const handleApplyCoupon = async (requestedCode?: string, options: { allowGiftOffer?: boolean } = {}) => {
    const normalizedCode = (requestedCode ?? couponCodeInput).trim().toUpperCase()
    if (!normalizedCode) return

    const isKnownGiftOffer = normalizedCode === giftPromotion?.code || normalizedCode === requestedPromotion?.code
    if (isKnownGiftOffer && !options.allowGiftOffer) {
      setErrorMessage('Gift offers are selected from the cart or product page before checkout.')
      return
    }

    setCouponLoading(true)
    try {
      const response = await fetch('/api/checkout/coupon', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code: normalizedCode,
          items: checkoutItems.map((item) => ({
            slug: item.slug,
            name: item.name,
            metalVariantId: item.metalVariantId,
            metal: item.metal,
            purity: item.purity,
            quantity: item.quantity,
          })),
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.coupon) {
        const minimumOrderAmount = Number(appliedCoupon?.minimumOrderAmount ?? 0)
        if (cartMode && normalizedCode === appliedCoupon?.code && minimumOrderAmount > 0 && isExplicitMinimumOrderCouponError(payload?.error)) {
          setRequestedCouponCode(normalizedCode)
          localStorage.setItem(REQUESTED_COUPON_KEY, normalizedCode)
          localStorage.removeItem(APPLIED_COUPON_KEY)
          setCouponCodeInput('')
          setErrorMessage('')
          return
        }
        setAppliedCoupon(null)
        if (cartMode) {
          localStorage.removeItem(APPLIED_COUPON_KEY)
          localStorage.removeItem(REQUESTED_COUPON_KEY)
          setRequestedCouponCode('')
          setRequestedPromotion(null)
        }
        setErrorMessage(response.status >= 500 ? 'We could not validate that coupon right now. Please try again shortly.' : payload?.error ?? 'Unable to apply coupon.')
        return
      }

      setAppliedCoupon(payload.coupon)
      restoredAppliedCouponCodeRef.current = null
      setCouponCodeInput(payload.coupon.code)
      if (cartMode) {
        localStorage.setItem(APPLIED_COUPON_KEY, JSON.stringify(payload.coupon))
        if (requestedCouponCode === payload.coupon.code) {
          localStorage.removeItem(REQUESTED_COUPON_KEY)
          setRequestedCouponCode('')
          setRequestedPromotion(null)
        }
      }
      setErrorMessage('')
    } catch {
      setErrorMessage('We could not validate that coupon. Check your connection and try again.')
    } finally {
      setCouponLoading(false)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCodeInput('')
    if (cartMode) {
      localStorage.removeItem(APPLIED_COUPON_KEY)
      localStorage.removeItem(REQUESTED_COUPON_KEY)
      setRequestedCouponCode('')
      setRequestedPromotion(null)
    }
  }

  useEffect(() => {
    if (!cartMode || !appliedCoupon || !checkoutItems.length || restoredAppliedCouponCodeRef.current !== appliedCoupon.code || couponLoading) return
    restoredAppliedCouponCodeRef.current = null
    void handleApplyCoupon(appliedCoupon.code, { allowGiftOffer: true })
  }, [appliedCoupon, cartMode, checkoutItems, couponLoading])

  useEffect(() => {
    if (
      cartMode ||
      appliedCoupon ||
      !directGiftCouponCode ||
      !giftPromotion ||
      directGiftCouponCode !== giftPromotion.code ||
      !checkoutItems.length ||
      couponLoading
    ) return
    const attemptKey = `${directGiftCouponCode}:${JSON.stringify(checkoutItems.map((item) => [item.slug, item.metalVariantId, item.quantity]))}`
    if (requestedCouponAttemptRef.current === attemptKey) return
    requestedCouponAttemptRef.current = attemptKey
    void handleApplyCoupon(directGiftCouponCode, { allowGiftOffer: true })
  }, [appliedCoupon, cartMode, checkoutItems, couponLoading, directGiftCouponCode, giftPromotion])

  if (sessionLoading) {
    return (
      <section className="min-h-[calc(100vh-111px)] bg-white px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1240px] rounded-[24px] border border-[#e7ebf0] bg-white p-6 text-sm text-[#292727] shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
          Loading checkout...
        </div>
      </section>
    )
  }

  if (cartMode && cartItems.length > 0 && resolvedCartItems.length === 0) {
    return (
      <section className="min-h-[calc(100vh-111px)] bg-white px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1240px] rounded-[24px] border border-[#e7ebf0] bg-white p-6 text-sm text-[#292727] shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
          Loading checkout...
        </div>
      </section>
    )
  }

  if (!checkoutItems.length) {
    return (
      <section className="min-h-[calc(100vh-111px)] bg-white px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[720px] rounded-[24px] border border-[#e7ebf0] bg-white p-8 text-center shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
          <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-[#101828]">Nothing ready for checkout</h1>
          <p className="mt-3 text-sm leading-7 text-[#292727]">Add a product to cart or start checkout from a product page first.</p>
          <div className="mt-6">
            <Link href="/shop" className="inline-flex h-11 items-center justify-center rounded-full bg-[#101828] px-6 text-sm font-medium text-white transition hover:bg-[#1d2939]">
              Explore Products
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="min-h-[calc(100vh-111px)] bg-white px-4 py-8 sm:px-6 lg:px-10">
      {paymentUiStage === 'confirming' ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[rgba(247,248,250,0.82)] px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[28px] border border-[#e7ebf0] bg-white px-6 py-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:px-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#d0d5dd] bg-[#f8fafc]">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#d0d5dd] border-t-[#101828]" />
            </div>
            <div className="mt-5 text-[24px] font-semibold tracking-[-0.03em] text-[#101828]">Confirming your order</div>
            <p className="mt-2 text-sm leading-7 text-[#292727]">
              Your payment is done. We are now verifying Razorpay and preparing your order confirmation.
            </p>
          </div>
        </div>
      ) : null}
      <div className="mx-auto max-w-[1520px]">
        <div className="mb-6">
          <div className="flex items-end justify-between gap-5"><div><button type="button" onClick={() => router.back()} className="mb-3 inline-flex items-center gap-1.5 border-0 bg-transparent p-0 font-[family-name:var(--font-family-secondary)] text-[12px] text-black/60 transition hover:text-black"><ArrowLeft size={15} strokeWidth={1.7} />Back</button><h1 className="font-[family-name:var(--font-family-primary)] text-[22px] font-semibold uppercase text-black sm:text-[28px]">Checkout</h1></div><div className="font-[family-name:var(--font-family-secondary)] text-[12px] text-black/45"><span className={currentStep === 0 ? 'font-semibold text-black' : ''}>Shipping</span><span className="px-2">›</span><span className={currentStep === 1 ? 'font-semibold text-black' : ''}>Payment</span></div></div>
          <p className="mt-2 text-sm text-[#292727]">{cartMode ? 'Checkout synced to the products currently saved in your cart.' : 'Checkout preview for your selected product.'}</p>
        </div>

        <div className="sticky top-0 z-30 -mx-4 mb-5 flex min-h-12 w-[calc(100%+2rem)] items-center justify-between border-y border-black/10 bg-[#fbfbfb] px-4 font-[family-name:var(--font-family-secondary)] text-[13px] text-black shadow-[0_2px_8px_rgba(0,0,0,0.04)] sm:hidden">
          <span>{checkoutItems.reduce((sum, item) => sum + item.quantity, 0)} {checkoutItems.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'item' : 'items'}</span>
          <span className="flex items-center gap-3 font-semibold"><ChevronDown size={14} aria-hidden="true" />{format(subtotal)}</span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(350px,420px)] lg:gap-8">
          <div className="space-y-5">
            {errorMessage ? (
              <div className="rounded-[24px] border border-[rgba(220,38,38,0.18)] bg-[rgba(254,242,242,0.9)] px-5 py-4 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            {quoteStatus === 'error' && quoteError ? (
              <div className="rounded-[24px] border border-[rgba(217,119,6,0.22)] bg-[#fffaeb] px-5 py-4 text-sm text-[#b54708]">
                {quoteError} Payment remains unavailable until the checkout total is confirmed.
              </div>
            ) : null}

            {quoteStatus === 'ready' && hasAuthoritativePriceChange ? (
              <div className="rounded-[24px] border border-[#b2ddff] bg-[#eff8ff] px-5 py-4 text-sm text-[#175cd3]">
                One or more catalogue prices changed since this checkout was opened. The order summary now shows the latest confirmed price.
              </div>
            ) : null}

            {unavailableCartItemCount > 0 ? (
              <div className="rounded-[24px] border border-[rgba(217,119,6,0.22)] bg-[#fffaeb] px-5 py-4 text-sm text-[#b54708]">
                {unavailableCartItemCount} cart {unavailableCartItemCount === 1 ? 'item is' : 'items are'} no longer available.{' '}
                <Link href="/cart" className="font-medium underline underline-offset-2">Return to your cart</Link> to remove or reconfigure {unavailableCartItemCount === 1 ? 'it' : 'them'} before payment.
              </div>
            ) : null}

            {guestCheckout ? (
              <div className="border border-black/15 bg-white px-5 py-5 sm:px-7">
                <div className="font-[family-name:var(--font-family-primary)] text-[18px] font-medium uppercase text-black">Express checkout</div>
                <p className="mt-2 font-[family-name:var(--font-family-secondary)] text-[12px] leading-5 text-black/55">Continue as a guest or sign in to use your saved details.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Link href={`/login?next=${encodeURIComponent(`/checkout?${searchParams.toString()}`)}`} prefetch={false} className="flex min-h-11 items-center justify-center border border-black bg-white px-5 font-[family-name:var(--font-family-button)] text-[11px] font-semibold uppercase tracking-[0.1em] text-black transition hover:bg-black hover:text-white">Sign in</Link>
                  <div className="flex min-h-11 items-center justify-center border border-black bg-black px-5 font-[family-name:var(--font-family-button)] text-[11px] font-semibold uppercase tracking-[0.1em] text-white">Guest checkout</div>
                </div>
              </div>
            ) : null}
            <div className="animate-[fadeUp_0.35s_ease]">
              {currentStep === 0 ? <><CheckoutInformationStep form={customerForm} onChange={updateCustomerForm} errors={fieldErrors} postalLookup={postalLookup} onPostalBlur={handlePostalCodeBlur} postalAreaOptions={postalAreaOptions} onPostalAreaSelect={handlePostalAreaSelect} isGuest={guestCheckout} /><CheckoutDeliveryPreview items={checkoutItems} /></> : null}
              {currentStep === 1 ? <CheckoutConfirmationStep form={customerForm} itemCount={checkoutItems.reduce((sum, item) => sum + item.quantity, 0)} onEdit={() => setCurrentStep(0)} onPay={handlePayNow} processing={processingPayment} disabled={quoteStatus !== 'ready' || unavailableCartItemCount > 0} message={unavailableCartItemCount > 0 ? 'Resolve unavailable cart items before payment.' : quoteStatus === 'loading' && quoteLoadingNotice ? 'Checking your order…' : quoteStatus === 'error' ? quoteError : undefined} /> : null}
            </div>
            {!isLastStep ? (
              <div className="flex justify-end">
                <button type="button" onClick={handleNextStep} className="flex min-h-12 items-center justify-center border border-black bg-black px-8 font-[family-name:var(--font-family-button)] text-[11px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-white hover:text-black">Continue</button>
              </div>
            ) : null}
            {!isLastStep ? (
              <div className="flex justify-start">
                <Link
                  href={continueHref}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-transparent px-2 text-sm font-medium text-[#292727] transition hover:text-[#101828]"
                >
                  Continue Shopping
                </Link>
              </div>
            ) : null}
          </div>

          <div className="lg:sticky lg:top-[140px] lg:self-start">
            <div className="space-y-0">
              <CheckoutSummary
                topOffer={checkoutGiftPromotion ? <GiftOfferBanner
                  promotion={checkoutGiftPromotion}
                  amount={subtotal}
                  checked={hasAppliedGift || Boolean(requestedCouponCode)}
                  included={hasAppliedGift}
                  displayOnly
                  confirmationTone="green"
                /> : null}
                summary={{
                  items: authoritativeCheckoutItems,
                  couponCode: appliedCoupon?.code,
                  couponDiscount,
                  loveLetter: loveLetterDraft,
                  chargeQuote,
                  gift: authoritativePricing?.gift || appliedCoupon?.gift || null,
                }}
                couponValue={couponCodeInput}
                onCouponChange={setCouponCodeInput}
                onCouponAction={() => { if (appliedCoupon) handleRemoveCoupon(); else void handleApplyCoupon() }}
                couponApplied={Boolean(appliedCoupon)}
                couponLoading={couponLoading}
                couponMessage={errorMessage}
              />
              <AdditionalSummaryDetails />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
