'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { CheckoutSummaryData } from '@/components/checkout/types'
import { useCurrency } from '@/context/CurrencyContext'
import { formatMoney } from '@/lib/currency'
import { fetchPublicJson } from '@/lib/client/public-json'

function selectionLabel(item: CheckoutSummaryData['items'][number]) {
  return [item.purity, item.metal, item.sizeOrFit, item.gemstone, item.carat].filter(Boolean).join(', ')
}

type SummaryProps = {
  summary: CheckoutSummaryData
  topOffer?: ReactNode
  couponValue?: string
  onCouponChange?: (value: string) => void
  onCouponAction?: () => void
  couponApplied?: boolean
  couponLoading?: boolean
  couponMessage?: string
  giftOffer?: { name: string; imageUrl?: string; minimumOrderAmount: number; remainingAmount: number; unlocked: boolean; added?: boolean; appliedCouponCode?: string; appliedDiscountAmount?: number; isDiscount?: boolean; onAction?: () => void } | null
  shippingLabel?: string
  belowSummary?: ReactNode
  compact?: boolean
  whiteBackground?: boolean
}

export default function CheckoutSummary({ summary, topOffer, couponValue = '', onCouponChange, onCouponAction, couponApplied = false, couponLoading = false, couponMessage = '', giftOffer = null, shippingLabel = 'Complimentary', belowSummary, compact = false, whiteBackground = false }: SummaryProps) {
  const { format } = useCurrency()
  const [itemsOpen, setItemsOpen] = useState(false)
  const [promoOpen, setPromoOpen] = useState(true)
  const [estimatedDeliveryText, setEstimatedDeliveryText] = useState('Approximately 3 to 4 weeks')
  useEffect(() => {
    let active = true
    fetchPublicJson<{ item?: { estimated_delivery_text?: unknown } }>('/api/public/settings')
      .then(({ payload: result }) => {
        if (active && typeof result?.item?.estimated_delivery_text === 'string' && result.item.estimated_delivery_text.trim()) {
          setEstimatedDeliveryText(result.item.estimated_delivery_text.trim())
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [])
  const subtotal = summary.items.reduce((sum, item) => sum + item.priceFrom * item.quantity, 0)
  const couponDiscount = Math.max(0, summary.couponDiscount ?? 0)
  const taxableSubtotal = Math.max(0, subtotal - couponDiscount)
  const gstAmount = summary.items.reduce((sum, item) => {
    const lineSubtotal = item.priceFrom * item.quantity
    const discountShare = subtotal > 0 ? couponDiscount * (lineSubtotal / subtotal) : 0
    return sum + Math.max(0, lineSubtotal - discountShare) * ((item.gstPercentage ?? 0) / 100)
  }, 0)
  const total = taxableSubtotal + gstAmount

  return (
    <aside className={`border border-black/10 ${whiteBackground ? 'bg-white' : 'bg-[#fbfbfb]'} p-3`}>
      {topOffer ? <div className={`mb-5 [&>aside]:mt-0 ${compact ? 'hidden sm:block' : ''}`}>{topOffer}</div> : null}
      {giftOffer ? <div className="mb-4 border-b border-black/10 pb-4">
        {giftOffer.isDiscount ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-[family-name:var(--font-family-primary)] text-[14px] font-semibold text-black">Discount applied</p>
              {giftOffer.appliedCouponCode ? <span className="border border-[#b7ddc5] bg-[#eaf7ee] px-2 py-1 font-[family-name:var(--font-family-secondary)] text-[10px] font-medium text-[#16804b]">{giftOffer.appliedCouponCode}</span> : null}
            </div>
            <p className="mt-1 font-[family-name:var(--font-family-secondary)] text-[12px] text-[#16804b]">You saved {format(giftOffer.appliedDiscountAmount ?? 0, { maximumFractionDigits: 2 })}.</p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              {giftOffer.imageUrl ? <div className="h-24 w-24 shrink-0 overflow-hidden border border-black/10 bg-white"><img src={giftOffer.imageUrl} alt={giftOffer.name} className="h-full w-full object-cover" /></div> : null}
              <div>
                <p className="font-[family-name:var(--font-family-primary)] text-[14px] font-semibold text-black">{giftOffer.name}</p>
                <p className={`mt-1 font-[family-name:var(--font-family-secondary)] text-[12px] ${giftOffer.unlocked ? 'text-[#16804b]' : 'text-black/75'}`}>
                  {giftOffer.added ? `Gift unlocked${giftOffer.appliedCouponCode ? ` with ${giftOffer.appliedCouponCode}` : ''}` : giftOffer.unlocked ? 'Unlocked with this order' : `Add ${format(giftOffer.remainingAmount, { maximumFractionDigits: 2 })} more to unlock`}
                </p>
              </div>
            </div>
            {!giftOffer.added ? <button type="button" onClick={giftOffer.onAction} className="mt-3 flex min-h-10 w-full items-center justify-center border border-black bg-black px-4 font-[family-name:var(--font-family-button)] text-[11px] font-semibold uppercase tracking-[0.08em] text-white">{giftOffer.unlocked ? 'Add my free gift' : 'Add more to unlock'}</button> : null}
          </>
        )}
      </div> : null}
      <h2 className={`font-[family-name:var(--font-family-primary)] font-normal text-black ${compact ? 'text-[18px]' : 'text-[22px]'}`}>Order Summary</h2>
      <button type="button" onClick={() => setItemsOpen((open) => !open)} className="mt-5 flex h-11 w-full items-center justify-between border border-black/10 bg-white px-3 font-[family-name:var(--font-family-secondary)] text-[13px] text-black">
        <span>{summary.items.reduce((count, item) => count + item.quantity, 0)} items</span><span className="flex items-center gap-3"><strong>{format(subtotal, { maximumFractionDigits: 2 })}</strong><ChevronDown size={14} className={itemsOpen ? 'rotate-180' : ''} /></span>
      </button>
      {itemsOpen ? <div className="mt-3 grid grid-cols-3 gap-3 border-b border-black/10 pb-4">
        {summary.items.map((item) => <div key={`${item.slug}-${item.metal || ''}-${item.sizeOrFit || ''}`} className="group relative aspect-square overflow-hidden border border-black/10 bg-white" title={`${item.name} x ${item.quantity}`}><img src={item.imageUrl || ''} alt={item.name} className="h-full w-full object-cover" /><span className="absolute bottom-1 right-1 bg-white/90 px-1.5 py-0.5 font-[family-name:var(--font-family-secondary)] text-[9px] text-black">{item.quantity}</span></div>)}
        {summary.gift ? <div className="relative aspect-square overflow-hidden border border-black/10 bg-white" title={summary.gift.name}><img src={summary.gift.imageUrl || ''} alt={summary.gift.name} className="h-full w-full object-cover" /><span className="absolute left-1 top-1 bg-[#eaf7ee] px-1.5 py-0.5 font-[family-name:var(--font-family-secondary)] text-[9px] font-medium uppercase text-[#16804b]">Free</span></div> : null}
      </div> : null}
      {itemsOpen ? <div className="divide-y divide-black/10">{summary.items.map((item) => <div key={`detail-${item.slug}-${item.metal || ''}-${item.sizeOrFit || ''}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3 font-[family-name:var(--font-family-secondary)]"><div><p className={`${compact ? 'text-[13px]' : 'text-[15px]'} font-semibold text-black`}>{item.name}</p>{selectionLabel(item) ? <p className={`${compact ? 'text-[12px]' : 'text-[14px]'} mt-1 leading-5 text-black`}>{selectionLabel(item)}</p> : null}<p className={`${compact ? 'text-[12px]' : 'text-[14px]'} mt-1 text-black`}>Qty {item.quantity}</p></div><span className={`${compact ? 'text-[13px]' : 'text-[15px]'} font-semibold text-black`}>{format(item.priceFrom * item.quantity, { maximumFractionDigits: 2 })}</span></div>)}{summary.gift ? <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3 font-[family-name:var(--font-family-secondary)]"><div><p className={`${compact ? 'text-[13px]' : 'text-[15px]'} font-semibold text-black`}>{summary.gift.name}</p><span className="mt-1 inline-flex border border-[#b7ddc5] bg-[#eaf7ee] px-1.5 py-0.5 text-[10px] font-medium uppercase text-[#16804b]">Free</span></div><span className={`${compact ? 'text-[13px]' : 'text-[15px]'} font-semibold text-black`}>{format(0, { maximumFractionDigits: 2 })}</span></div> : null}</div> : null}
      <div className="border-b border-black/10 py-4"><button type="button" onClick={() => setPromoOpen((open) => !open)} aria-expanded={promoOpen} className="flex w-full items-center justify-between border-0 bg-transparent p-0 font-[family-name:var(--font-family-secondary)] text-[13px] text-black"><span>{couponApplied ? <><span>Promo code </span><span className="border border-[#b7ddc5] bg-[#eaf7ee] px-2 py-1 text-[#16804b]">{summary.couponCode}</span></> : 'Add Promo Code'}</span><ChevronDown size={14} className={`transition-transform ${promoOpen ? 'rotate-180' : ''}`} /></button>{promoOpen ? <><div className="mt-3 flex h-10"><input value={couponValue} onChange={(event) => onCouponChange?.(event.target.value.toUpperCase())} disabled={couponApplied} placeholder="Enter code" className="min-w-0 flex-1 border border-r-0 border-black/20 bg-white px-3 text-[13px] outline-none"/><button type="button" onClick={onCouponAction} disabled={couponLoading} className="border border-black bg-black px-4 text-[11px] font-semibold uppercase text-white">{couponApplied ? 'Remove' : couponLoading ? 'Checking' : 'Apply'}</button></div>{couponMessage ? <p role="status" className="mt-2 text-[12px] text-[#b42318]">{couponMessage}</p> : null}</> : null}</div>
      <div className="mt-5 space-y-3 font-[family-name:var(--font-family-secondary)] text-[14px] text-black/90"><div className="flex justify-between"><span>Subtotal</span><strong className="text-black">{format(subtotal, { maximumFractionDigits: 2 })}</strong></div>{couponDiscount > 0 ? <div className="flex justify-between"><span>Savings</span><strong className="text-[#16804b]">-{format(couponDiscount, { maximumFractionDigits: 2 })}</strong></div> : null}<div className="flex justify-between"><span>Shipping</span><span>{shippingLabel}</span></div><div className="flex justify-between"><span>Tax</span><span>{format(gstAmount, { maximumFractionDigits: 2 })}</span></div><div className="mt-4 flex justify-between border-t border-black/10 pt-4 font-[family-name:var(--font-family-primary)] text-[18px] font-semibold text-black"><span>Total</span><span>{format(total, { maximumFractionDigits: 2 })}</span></div>{summary.chargeQuote ? <p className="border-t border-black/10 pt-4 text-[13px] leading-4 text-black/80">You will be charged {formatMoney(summary.chargeQuote.totalCharged, summary.chargeQuote.chargeCurrency, { maximumFractionDigits: 2 })} at checkout.</p> : null}</div>
      <p className="mt-5 font-[family-name:var(--font-family-secondary)] text-[14px] font-medium leading-5 text-black">{estimatedDeliveryText}</p>
      {belowSummary}
    </aside>
  )
}
