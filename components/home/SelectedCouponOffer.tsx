'use client'

import { useEffect, useState } from 'react'
import { fetchPublicJson } from '@/lib/client/public-json'

type Offer = {
  discountType: 'percentage' | 'fixed'
  discountValue: number
  description: string | null
  minimumOrderAmount: number | null
}

function formatAmount(offer: Offer) {
  if (offer.discountType === 'percentage') return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(offer.discountValue)}%`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(offer.discountValue)
}

export default function SelectedCouponOffer() {
  const [offer, setOffer] = useState<Offer>({ discountType: 'percentage', discountValue: 10, description: 'Enjoy an exclusive saving on your next House of Diams piece.', minimumOrderAmount: null })

  useEffect(() => {
    let active = true
    // One shared request per page; the server and CDN keep the offer fresh
    // within a minute, so tab focus does not need to trigger refetches.
    fetchPublicJson<{ offer?: Offer | null }>('/api/public/promotion-popup/offer')
      .then(({ ok, payload }) => { if (active && ok && payload?.offer) setOffer(payload.offer) })
      .catch(() => { /* Keep the visible fallback offer when the endpoint is unavailable. */ })
    return () => { active = false }
  }, [])

  if (!offer) return null

  return (
    <section aria-labelledby="selected-coupon-offer-heading" className="w-full bg-[var(--color-brand-secondary)] px-[var(--space-4)] py-[var(--space-6)] text-center sm:px-[var(--space-6)] lg:py-[var(--space-6)]">
      <div className="mx-auto w-full">
        <p className="font-[family-name:var(--font-family-button)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-brand-primary)]">Exclusive offer</p>
        <h2 id="selected-coupon-offer-heading" className="mt-[var(--space-4)] font-[family-name:var(--font-family-primary)] text-[clamp(2.4rem,4.4vw,4.4rem)] font-medium leading-[1.08] text-[var(--color-brand-primary)]">Get {formatAmount(offer)} Off</h2>
        <p className="mx-auto mt-[var(--space-4)] max-w-[58ch] font-[family-name:var(--font-family-secondary)] text-sm leading-7 text-[var(--color-brand-primary)] sm:text-base">{offer.description || 'Discover fine jewellery and enjoy an exclusive offer selected for you.'}</p>
        <button type="button" onClick={() => window.dispatchEvent(new Event('hod:open-coupon-offer'))} className="mt-[var(--space-6)] inline-flex min-h-12 items-center justify-center bg-[var(--color-brand-primary)] px-[var(--space-6)] font-[family-name:var(--font-family-button)] text-xs font-semibold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-brand-primary)]">Get Your Coupon Code</button>
        {offer.minimumOrderAmount != null && offer.minimumOrderAmount > 0 ? <p className="mt-[var(--space-4)] font-[family-name:var(--font-family-secondary)] text-xs text-[var(--color-brand-primary)]">Minimum purchase {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(offer.minimumOrderAmount)}</p> : null}
      </div>
    </section>
  )
}

