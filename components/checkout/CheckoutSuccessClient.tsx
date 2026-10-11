'use client'

import Link from 'next/link'
import { getSafeContactHref } from '@/lib/contact-links'
import { useSearchParams } from 'next/navigation'
import { CalendarDays, CreditCard, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatMoney } from '@/lib/currency'

const GUEST_CHECKOUT_TOKEN_KEY = 'hod_guest_checkout_token'
const FALLBACK_IMAGE = '/HOD%20specs/profile%20banner/wesfly-jzXYuYd-o00-unsplash.jpg'

type ResultState = 'success' | 'pending' | 'failed' | 'error'
type Item = { product_name: string; product_slug?: string | null; quantity: number; line_total: number; image_url?: string | null; selected_metal?: string | null; selected_purity?: string | null; selected_size_or_fit?: string | null; selected_gemstone?: string | null; selected_carat?: string | null; item_type?: string | null }
type Order = { order_number: string; created_at: string; status?: string | null; payment_status?: string | null; customer_email?: string | null; customer_first_name?: string | null; customer_last_name?: string | null; customer_phone?: string | null; customer_birth_date?: string | null; customer_anniversary_date?: string | null; shipping_country?: string | null; shipping_state?: string | null; shipping_district?: string | null; shipping_city?: string | null; shipping_postal_code?: string | null; shipping_address_line_1?: string | null; shipping_address_line_2?: string | null; subtotal_amount: number; gst_amount: number; shipping_amount: number; total_amount: number; payment_amount?: number | null; payment_currency?: string | null; payment_gateway?: string | null; razorpay_payment_method?: string | null; items: Item[] }
type StatusEvent = { status: string; created_at: string }
type Payload = { state: ResultState; order: Order; statusEvents?: StatusEvent[]; cms?: { page?: { main_banner_image_url?: string; main_banner_image_alt?: string; secondary_banner_image_url?: string; secondary_banner_image_alt?: string; secondary_eyebrow?: string; secondary_heading?: string; secondary_paragraph?: string } | null; state?: { eyebrow?: string; heading?: string; paragraph?: string; order_button_label?: string } | null }; contact?: Array<{ id: string; label?: string; value?: string; note?: string; href?: string }>; categories?: Array<{ name: string; slug: string }> }

const copy: Record<ResultState, { eyebrow: string; heading: string; paragraph: string; button: string }> = {
  success: { eyebrow: 'Order confirmed', heading: 'A beautiful choice, now officially yours.', paragraph: 'Your order has been successfully placed and our team is preparing it with care.', button: 'View my order' },
  pending: { eyebrow: 'Payment confirmation pending', heading: 'We are confirming your order.', paragraph: 'Your payment status is still being confirmed. Please check again shortly.', button: 'View order status' },
  failed: { eyebrow: 'Payment unsuccessful', heading: 'Your order has not been completed.', paragraph: 'The payment was not completed. You can safely return to checkout and try again.', button: 'Return to checkout' },
  error: { eyebrow: 'Confirmation unavailable', heading: 'We could not confirm your order right now.', paragraph: 'Your payment may still be processing. Please check again shortly or contact our concierge.', button: 'Try again' },
}

const money = (value: number, currency?: string | null) => formatMoney(Number(value || 0), currency || 'USD', { maximumFractionDigits: 0 })
const date = (value: string) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value))

function readOrderPreview(orderNumber: string): Payload | null {
  if (typeof window === 'undefined' || !orderNumber) return null
  try {
    const raw = sessionStorage.getItem(`hod_order_preview_${orderNumber}`)
    if (!raw) return null
    const preview = JSON.parse(raw) as Payload
    return preview?.order?.order_number === orderNumber && preview.state ? preview : null
  } catch {
    return null
  }
}

const ORDER_STEPS = [
  { label: 'Payment received', description: 'Your payment has been securely recorded.' },
  { label: 'Order confirmed', description: 'Your piece has been accepted for fulfillment.' },
  { label: 'Preparing your piece', description: 'Our team is quality-checking and preparing your order.' },
  { label: 'Dispatched', description: 'Your order is on its way. Tracking will follow when available.' },
  { label: 'Delivered', description: 'Your House of Diams piece has been delivered.' },
]

function statusStep(status: string | null | undefined) {
  const value = String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (['delivered', 'complete', 'completed'].includes(value)) return 4
  if (['shipped', 'dispatched', 'out_for_delivery', 'out_for_dispatch'].includes(value)) return 3
  if (['processing', 'preparing', 'in_production', 'packed', 'quality_check'].includes(value)) return 2
  if (['confirmed', 'paid', 'payment_received'].includes(value)) return 1
  return 0
}

function isFailureStatus(status: string | null | undefined) {
  return ['failed', 'cancelled', 'canceled', 'refunded', 'refund_pending'].includes(String(status || '').trim().toLowerCase())
}

function OrderProgress({ order, events = [] }: { order: Order; events?: StatusEvent[] }) {
  const failed = isFailureStatus(order.status) || isFailureStatus(order.payment_status)
  const currentStep = failed ? 0 : Math.max(statusStep(order.status), ['paid', 'captured', 'success'].includes(String(order.payment_status || '').toLowerCase()) ? 1 : 0)
  const eventByStep = new Map<number, StatusEvent>()
  events.forEach((event) => {
    const step = statusStep(event.status)
    if (!eventByStep.has(step)) eventByStep.set(step, event)
  })
  const progress = failed ? 0 : (currentStep / (ORDER_STEPS.length - 1)) * 100
  const currentLabel = failed ? 'Order requires attention' : ORDER_STEPS[currentStep].label

  return <section className="mx-auto max-w-[1440px] px-5 pb-14 sm:px-8 lg:px-12">
    <div className="pt-5">
      <div className="flex items-center justify-between gap-4 border-b border-black/10 pb-3">
        <h2 className="font-[family-name:var(--font-family-secondary)] text-[13px] font-semibold uppercase tracking-[0.14em] text-black">What happens next</h2>
        <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${failed ? 'text-[#b42318]' : currentStep === 0 ? 'text-[#92400e]' : currentStep === 4 ? 'text-[#166534]' : 'text-[#176b3a]'}`}>{failed ? 'Attention needed' : currentStep === 0 ? 'Awaiting update' : currentLabel}</span>
      </div>
      <ol className="relative mt-5 grid gap-6 md:grid-cols-5 md:gap-0">
        <div className="absolute left-[10%] right-[10%] top-[18px] hidden h-px bg-black/30 md:block" aria-hidden="true"><div className={failed ? 'h-full bg-[#b42318]' : 'h-full bg-[#177245] transition-[width] duration-500'} style={{ width: `${progress}%` }} /></div>
        {ORDER_STEPS.map((step, index) => {
          const isComplete = !failed && index < currentStep
          const isCurrent = !failed && index === currentStep
          const event = eventByStep.get(index)
          return <li key={step.label} className="relative z-[1] min-w-0 text-left md:px-3 md:text-center"><span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full border bg-white text-[12px] font-semibold md:mx-auto ${failed && index === 0 ? 'border-[#b42318] text-[#b42318]' : isComplete ? 'border-[#177245] text-[#176b3a]' : isCurrent ? 'border-[#b7791f] text-[#92400e]' : 'border-black/70 text-black'}`}>{isComplete ? '✓' : index + 1}</span><h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black">{step.label}</h3><p className="mt-2 text-[12px] leading-[1.35] text-[#292727]">{failed && index === 0 ? 'Payment or order processing could not be completed.' : step.description}</p>{event ? <p className="mt-2 text-[10px] uppercase tracking-[0.06em] text-[#292727]">Updated {date(event.created_at)}</p> : null}</li>
        })}
      </ol>
    </div>
  </section>
}

export default function CheckoutSuccessClient({ customerAuthEnabled = false }: { customerAuthEnabled?: boolean }) {
  const searchParams = useSearchParams()
  const requestedOrder = searchParams.get('order')?.trim() || ''
  const [payload, setPayload] = useState<Payload | null>(() => readOrderPreview(requestedOrder))
  const [state, setState] = useState<ResultState | 'loading'>(() => readOrderPreview(requestedOrder)?.state ?? 'loading')
  const [guestOrder, setGuestOrder] = useState(false)
  const [estimatedDeliveryText, setEstimatedDeliveryText] = useState('Approximately 3 to 4 weeks')

  useEffect(() => {
    let active = true
    fetch('/api/public/settings', { cache: 'no-store' })
      .then((response) => response.json())
      .then((result) => {
        if (active && typeof result?.item?.estimated_delivery_text === 'string' && result.item.estimated_delivery_text.trim()) {
          setEstimatedDeliveryText(result.item.estimated_delivery_text.trim())
        }
      })
      .catch(() => { })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    let timer: number | undefined
    let attempts = 0
    async function load() {
      if (!requestedOrder) { setState('error'); return }
      const session = customerAuthEnabled
        ? await fetch('/api/customer-auth/session', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).catch(() => null)
        : null
      const hasCustomerSession = session?.authenticated === true && session?.identity?.emailVerified === true
      const guestToken = hasCustomerSession ? null : sessionStorage.getItem(GUEST_CHECKOUT_TOKEN_KEY)
      if (!hasCustomerSession && !guestToken) { setState('error'); return }
      try {
        const response = await fetch(`/api/checkout/success?order=${encodeURIComponent(requestedOrder)}`, { cache: 'no-store', headers: guestToken ? { 'x-guest-checkout-token': guestToken } : {} })
        const result = await response.json().catch(() => null) as Payload | null
        if (!active) return
        if (!response.ok || !result?.order) { setState(response.status >= 500 ? 'error' : 'failed'); return }
        setPayload(result); setState(result.state); setGuestOrder(!hasCustomerSession)
        attempts += 1
        if (result.state === 'pending' && attempts < 20) timer = window.setTimeout(() => void load(), 3000)
      } catch { if (active) setState('error') }
    }
    void load()
    return () => { active = false; if (timer) window.clearTimeout(timer) }
  }, [requestedOrder, customerAuthEnabled])

  if (state === 'loading') return <div className="flex min-h-[60vh] items-center justify-center bg-white font-[family-name:var(--font-family-secondary)] text-sm uppercase tracking-[0.18em] text-neutral-600">Confirming your order...</div>

  const fallback = copy[state]
  const cms = payload?.cms?.state
  const page = payload?.cms?.page
  const order = payload?.order
  const mainImage = page?.main_banner_image_url || FALLBACK_IMAGE
  const secondaryImage = page?.secondary_banner_image_url || FALLBACK_IMAGE
  const buttonHref = state === 'failed' ? '/checkout' : order ? '#order-details' : `/checkout/success?order=${encodeURIComponent(requestedOrder)}`
  const paidAmount = order?.payment_amount ?? order?.total_amount ?? 0
  const address = order ? [order.shipping_address_line_1, order.shipping_address_line_2, order.shipping_city, order.shipping_district, order.shipping_state, order.shipping_postal_code, order.shipping_country].filter(Boolean).join(', ') : ''

  return <main className="bg-white text-[#111]">
    <section className="relative flex min-h-[440px] items-center overflow-hidden border-b border-black/10 bg-[#f4f2ef] px-6 py-16 sm:px-10 lg:px-[8vw]" style={{ backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.05) 0%, rgba(0,0,0,.05) 44%, rgba(0,0,0,.05) 76%), url('${mainImage}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="relative z-10 max-w-[610px] text-white">
        <p className="font-[family-name:var(--font-family-secondary)] text-[11px] uppercase tracking-[0.22em]">{cms?.eyebrow || fallback.eyebrow}</p>
        <h1 className="mt-5 font-[family-name:var(--font-family-primary)] text-4xl font-normal leading-[1.05] sm:text-5xl lg:text-[58px]">{cms?.heading || fallback.heading}</h1>
        <p className="mt-5 max-w-xl font-[family-name:var(--font-family-secondary)] text-sm leading-7 text-white/85">{cms?.paragraph || fallback.paragraph}</p>
        <a href={buttonHref} className="mt-7 inline-flex h-12 items-center justify-center border border-white bg-white px-8 font-[family-name:var(--font-family-button)] text-xs uppercase tracking-[0.16em] text-black transition hover:bg-transparent hover:text-white">{cms?.order_button_label || fallback.button}</a>
        {order ? <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/35 pt-4 font-[family-name:var(--font-family-secondary)] text-xs uppercase tracking-[0.12em]"><span>Order #{order.order_number}</span><span>Placed {date(order.created_at)}</span></div> : null}
      </div>
    </section>

    {order ? <section id="order-details" className="mx-auto grid max-w-[1440px] gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:px-12">
      <article className="border border-black/15 p-6 sm:p-8">
        <h2 className="font-[family-name:var(--font-family-secondary)] text-sm uppercase tracking-[0.16em]">Order details</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <div><CalendarDays size={19} /><p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-neutral-500">Estimated delivery</p><p className="mt-1 text-sm">{estimatedDeliveryText}</p></div>
          <div><MapPin size={19} /><p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-neutral-500">Shipping to</p><p className="mt-1 text-sm leading-6">{[order.customer_first_name, order.customer_last_name].filter(Boolean).join(' ')}<br />{address}</p></div>
          <div><CreditCard size={19} /><p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-neutral-500">Payment method</p><p className="mt-1 text-sm capitalize">{order.razorpay_payment_method || order.payment_gateway || 'Online payment'}</p></div>
          {order.customer_birth_date || order.customer_anniversary_date ? <div><CalendarDays size={19} /><p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-neutral-500">Customer dates</p><p className="mt-1 text-sm leading-6">{order.customer_birth_date ? <>Birth date: {date(order.customer_birth_date)}<br /></> : null}{order.customer_anniversary_date ? <>Anniversary: {date(order.customer_anniversary_date)}</> : null}</p></div> : null}
        </div>
      </article>
      <article className="border border-black/15 p-6 sm:p-8">
        <div className="flex items-center justify-between"><h2 className="font-[family-name:var(--font-family-secondary)] text-sm uppercase tracking-[0.16em]">Your order</h2>{!guestOrder ? <Link href="/profile?tab=orders" className="text-xs underline underline-offset-4">View order details</Link> : null}</div>
        <div className="mt-5 divide-y divide-black/10">{order.items.map((item, index) => <div key={`${item.product_name}-${index}`} className="grid grid-cols-[78px_1fr_auto] gap-4 py-4 first:pt-0"><div className="aspect-square bg-[#f5f5f5]">{item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-contain" /> : null}</div><div><p className="text-sm font-medium">{item.product_name}</p><p className="mt-1 text-xs leading-5 text-neutral-500">{[item.selected_metal, item.selected_purity, item.selected_size_or_fit, item.selected_gemstone, item.selected_carat].filter(Boolean).join(', ')}</p><p className="mt-2 text-xs text-neutral-500">Qty {item.quantity}{item.item_type === 'free_gift' ? ' - Complimentary gift' : ''}</p></div><p className="text-sm font-medium">{item.item_type === 'free_gift' ? 'Free' : money(item.line_total, order.payment_currency)}</p></div>)}</div>
        <div className="ml-auto mt-5 max-w-xs space-y-2 border-t border-black/10 pt-4 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{money(order.subtotal_amount, order.payment_currency)}</span></div><div className="flex justify-between"><span>Shipping</span><span>{Number(order.shipping_amount) ? money(order.shipping_amount, order.payment_currency) : 'Complimentary'}</span></div><div className="flex justify-between"><span>GST</span><span>{money(order.gst_amount, order.payment_currency)}</span></div><div className="flex justify-between border-t border-black/10 pt-3 text-base font-semibold"><span>Paid</span><span>{money(paidAmount, order.payment_currency)}</span></div></div>
      </article>
    </section> : null}

    {order ? <OrderProgress order={order} events={payload?.statusEvents} /> : null}

    <section className="relative flex min-h-[260px] items-center bg-neutral-900 px-6 py-12 text-white sm:px-10 lg:px-[8vw]" style={{ backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.05), rgba(0,0,0,.05)), url('${secondaryImage}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}><div className="max-w-xl"><p className="text-[10px] uppercase tracking-[0.2em]">{page?.secondary_eyebrow || 'Made with intention'}</p><h2 className="mt-3 font-[family-name:var(--font-family-primary)] text-4xl">{page?.secondary_heading || 'Every piece tells a story.'}</h2><p className="mt-3 text-sm leading-7 text-white/85">{page?.secondary_paragraph || 'Your jewellery is prepared and inspected with care before it begins its journey to you.'}</p></div></section>

    <section className="mx-auto grid max-w-[1440px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_1.35fr] lg:px-12"><div><h2 className="text-xs uppercase tracking-[0.16em]">Need anything?</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">{(payload?.contact?.length ? payload.contact.slice(0, 2) : [{ id: 'fallback', label: 'Contact concierge', value: 'We are here to help with your order.' }]).map(item => { const href = getSafeContactHref(item.href); return <div key={item.id}><p className="text-xs font-semibold uppercase tracking-[0.12em]">{item.label}</p>{href ? <a href={href} className="mt-2 block text-sm underline underline-offset-4">{item.value}</a> : <p className="mt-2 text-sm">{item.value}</p>}<p className="mt-1 text-xs text-neutral-500">{item.note}</p></div> })}</div></div><div><h2 className="text-xs uppercase tracking-[0.16em]">Continue exploring</h2><div className="mt-5 grid gap-3 sm:grid-cols-3">{(payload?.categories || []).map(category => <Link key={category.slug} href={`/collections/${category.slug}`} className="flex h-12 items-center justify-between border border-black/20 px-4 text-xs uppercase tracking-[0.1em] hover:bg-black hover:text-white"><span>{category.name}</span><span aria-hidden>+</span></Link>)}</div></div></section>
  </main>
}
