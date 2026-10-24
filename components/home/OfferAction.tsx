'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { HomeOfferAction } from '@/lib/home-offer'

const buttonClass = 'inline-flex min-h-12 items-center justify-center border border-black bg-black px-8 font-[family-name:var(--font-family-button)] text-[11px] font-semibold uppercase tracking-[0.14em] text-white no-underline transition-colors hover:bg-white hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black'

/** Under the offers banner: a link to the free gift, or a coupon code that is revealed (and can be copied) on request. */
export default function OfferAction({ action }: { action: HomeOfferAction }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  if (!action) return null

  if (action.kind === 'gift') {
    return <Link href={action.href} className={buttonClass}>View gift{action.giftName ? `: ${action.giftName}` : ''}</Link>
  }

  async function copy(code: string) {
    try { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 2000) }
    catch { setCopied(false) }
  }

  return revealed ? (
    <div className="flex flex-wrap items-center justify-center gap-3" role="status" aria-live="polite">
      <span className="border border-dashed border-black px-6 py-3 font-[family-name:var(--font-family-primary)] text-[18px] font-semibold tracking-[0.18em] text-black" data-testid="offer-code">{action.code}</span>
      <button type="button" onClick={() => void copy(action.code)} className="min-h-12 border border-black px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-black hover:bg-black hover:text-white">{copied ? 'Copied' : 'Copy code'}</button>
    </div>
  ) : (
    <button type="button" onClick={() => setRevealed(true)} className={buttonClass}>Reveal code</button>
  )
}
