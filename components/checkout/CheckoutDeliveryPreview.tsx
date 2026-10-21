'use client'

import { Truck } from 'lucide-react'
import type { CheckoutDisplayItem } from '@/components/checkout/types'
import { useCurrency } from '@/context/CurrencyContext'

export default function CheckoutDeliveryPreview({ items }: { items: CheckoutDisplayItem[] }) {
  const { format } = useCurrency()
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  return (
    <section className="mt-5 border border-black/10 bg-white p-6 sm:p-8 lg:p-10" aria-labelledby="checkout-delivery-heading">
      <div className="flex items-center gap-3"><Truck size={24} strokeWidth={1.5} className="text-black" /><h2 id="checkout-delivery-heading" className="font-[family-name:var(--font-family-primary)] text-[20px] font-semibold uppercase text-black">Delivery <span className="font-[family-name:var(--font-family-secondary)] text-[13px] font-medium normal-case">({itemCount} {itemCount === 1 ? 'Item' : 'Items'})</span></h2></div>
      <div className="mt-7 divide-y divide-black/10">
        {items.map((item) => {
          const details = [item.metal, item.purity, item.sizeOrFit, item.gemstone, item.carat].filter(Boolean).join(', ')
          return <article key={`${item.slug}-${item.metal || ''}-${item.sizeOrFit || ''}`} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-start gap-5 py-5 first:pt-0"><div className="aspect-square overflow-hidden bg-[#f7f7f7]">{item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" /> : null}</div><div className="min-w-0"><h3 className="font-[family-name:var(--font-family-secondary)] text-[16px] font-semibold text-black">{item.name}</h3>{details ? <p className="mt-2 font-[family-name:var(--font-family-secondary)] text-[14px] leading-5 text-black/80">{details}</p> : null}<p className="mt-4 font-[family-name:var(--font-family-secondary)] text-[14px] text-black/80">Qty {item.quantity}</p></div><p className="font-[family-name:var(--font-family-secondary)] text-[16px] font-semibold text-black">{format(item.priceFrom * item.quantity, { maximumFractionDigits: 2 })}</p></article>
        })}
      </div>
      <div className="mt-4 border border-[#858585] px-5 py-6 sm:px-8"><div className="flex items-start justify-between gap-6"><div><p className="font-[family-name:var(--font-family-secondary)] text-[16px] font-semibold text-black">Complimentary Overnight Shipping with Signature</p><p className="mt-2 font-[family-name:var(--font-family-secondary)] text-[15px] text-black/80">Order before 3 PM for prompt dispatch and delivery updates.</p></div><span className="shrink-0 font-[family-name:var(--font-family-secondary)] text-[16px] font-medium text-black">Complimentary</span></div></div>
    </section>
  )
}
