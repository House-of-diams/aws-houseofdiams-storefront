'use client'

import { BadgeCheck, Globe2, ShieldCheck, Truck } from 'lucide-react'

const TRUST_ITEMS = [
  { label: 'Complimentary Overnight Shipping', Icon: Truck },
  { label: 'IGI Certified', Icon: BadgeCheck },
  { label: 'Free Worldwide Delivery', Icon: Globe2 },
  { label: 'Lifetime Warranty', Icon: ShieldCheck },
]

export default function HomeTrustStripe() {
  return (
    <section aria-label="House of Diams promises" className="flex min-h-[102px] w-full items-center justify-center bg-[var(--color-section-soft)] px-4 py-4">
      <div className="grid w-full max-w-[520px] grid-cols-4 items-start justify-items-center gap-x-2 gap-y-4 sm:flex sm:w-auto sm:max-w-none sm:justify-center sm:gap-10 lg:gap-16">
        {TRUST_ITEMS.map(({ label, Icon }) => (
          <div key={label} className="flex min-w-0 flex-col items-center justify-start gap-1 text-center text-black sm:flex-row sm:gap-2.5 sm:whitespace-nowrap">
            <Icon aria-hidden="true" size={19} strokeWidth={1.5} className="shrink-0 text-[#0A1628]" />
            <span className="font-[family-name:var(--font-family-secondary)] text-[8px] font-medium uppercase leading-[1.25] tracking-[0.025em] sm:text-[11px] sm:leading-normal sm:tracking-[0.08em]">{label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
