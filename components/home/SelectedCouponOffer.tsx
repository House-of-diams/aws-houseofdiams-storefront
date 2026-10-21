'use client'

import { useEffect, useState } from 'react'
import { fetchPublicJson } from '@/lib/client/public-json'
import { DEFAULT_OFFER_SECTION, fillOfferTokens, type OfferSectionContent } from '@/lib/offer-section'

type Offer = {
  discountType: 'percentage' | 'fixed'
  discountValue: number
  description: string | null
  minimumOrderAmount: number | null
}

type Gift = { minimumOrderAmount: number | null; description: string | null }
type OfferPayload = { offer?: Offer | null; gift?: Gift | null; content?: OfferSectionContent }

const usd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)

function formatAmount(offer: Offer) {
  if (offer.discountType === 'percentage') return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(offer.discountValue)}%`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(offer.discountValue)
}

export default function SelectedCouponOffer() {
  // No invented fallback: nothing shows unless a real coupon is selected and the section is enabled.
  const [data, setData] = useState<{ offer: Offer | null; gift: Gift | null; content: OfferSectionContent }>({ offer: null, gift: null, content: DEFAULT_OFFER_SECTION })

  useEffect(() => {
    let active = true
    // One shared request per page; the server and CDN keep the offer fresh
    // within a minute, so tab focus does not need to trigger refetches.
    fetchPublicJson<OfferPayload>('/api/public/promotion-popup/offer')
      .then(({ ok, payload }) => { if (active) setData({ offer: ok ? payload?.offer ?? null : null, gift: ok ? payload?.gift ?? null : null, content: payload?.content ?? DEFAULT_OFFER_SECTION }) })
      .catch(() => { /* Endpoint unavailable: show no offer rather than a wrong one. */ })
    return () => { active = false }
  }, [])

  const { offer, gift, content } = data
  if (!content.isEnabled || (!offer && !gift)) return null
  const minimum = offer?.minimumOrderAmount ?? gift?.minimumOrderAmount ?? null
  const heading = offer
    ? fillOfferTokens(content.heading, { offer: formatAmount(offer), minimum: minimum ? usd(minimum) : '' })
    : fillOfferTokens(content.giftHeading, { minimum: minimum ? usd(minimum) : '' })
  const body = content.description || offer?.description || gift?.description || 'Discover fine jewellery and enjoy an exclusive offer selected for you.'

  return (
    <section aria-labelledby="selected-coupon-offer-heading" className="w-full bg-[var(--color-brand-secondary)] px-[var(--space-4)] py-[var(--space-6)] text-center sm:px-[var(--space-6)] lg:py-[var(--space-6)]">
      <div className="mx-auto w-full">
        <p className="font-[family-name:var(--font-family-button)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-brand-primary)]">{content.label}</p>
        <h2 id="selected-coupon-offer-heading" className="mt-[var(--space-4)] font-[family-name:var(--font-family-primary)] text-[clamp(2.4rem,4.4vw,4.4rem)] font-medium leading-[1.08] text-[var(--color-brand-primary)]">{heading}</h2>
        <p className="mx-auto mt-[var(--space-4)] max-w-[58ch] font-[family-name:var(--font-family-secondary)] text-sm leading-7 text-[var(--color-brand-primary)] sm:text-base">{body}</p>
        <button type="button" onClick={() => window.dispatchEvent(new Event('hod:open-coupon-offer'))} className="mt-[var(--space-6)] inline-flex min-h-12 items-center justify-center bg-[var(--color-brand-primary)] px-[var(--space-6)] font-[family-name:var(--font-family-button)] text-xs font-semibold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-brand-primary)]">{content.buttonText}</button>
        {minimum != null && minimum > 0 ? <p className="mt-[var(--space-4)] font-[family-name:var(--font-family-secondary)] text-xs text-[var(--color-brand-primary)]">Minimum purchase {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(minimum)}</p> : null}
      </div>
    </section>
  )
}

