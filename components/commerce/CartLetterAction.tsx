'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import LoveLetterModal from '@/components/product/LoveLetterModal'
import { useCart } from '@/lib/hooks/useCart'
import type { LoveLetterDraft } from '@/lib/love-letter'
import { canAddLetterToLine, lineLetter, type StoredCartItem } from '@/lib/product-keys'

const linkClass = 'border-0 bg-transparent p-0 text-black underline underline-offset-2 hover:text-black/70'

/**
 * Next to Remove on a cart line: "Add letter" when the line has none, a "Letter added" badge (with Edit) when it has one.
 * An order carries a single letter, so while another line has it, this line offers nothing.
 */
export default function CartLetterAction({ item, size = 'small' }: { item: StoredCartItem; size?: 'small' | 'regular' }) {
  const { items, setLoveLetter } = useCart()
  const [open, setOpen] = useState(false)
  const letter = lineLetter(item)
  const text = size === 'regular' ? 'text-[12px]' : 'text-[11px]'

  if (!letter && !canAddLetterToLine(items, item.key)) return null

  const save = (draft: LoveLetterDraft) => {
    // "No letter" from the editor removes an existing letter; for a line without one it simply changes nothing.
    setLoveLetter(item.key, draft.wantsLetter ? draft : null)
    setOpen(false)
  }

  return (
    <>
      {letter ? (
        <span className="inline-flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border border-emerald-700/25 bg-emerald-50 px-2.5 py-1 font-semibold leading-none text-emerald-800 ${size === 'regular' ? 'text-[11px]' : 'text-[10px]'}`} data-testid="letter-added">
            <Check size={size === 'regular' ? 12 : 11} strokeWidth={2.2} aria-hidden="true" />Letter added
          </span>
          <button type="button" onClick={() => setOpen(true)} className={`${linkClass} ${text}`} aria-label="Edit the letter for this piece">Edit</button>
        </span>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`${linkClass} ${text}`} aria-label="Add a letter for this piece">Add letter</button>
      )}
      {open ? <LoveLetterModal onClose={() => setOpen(false)} onContinue={save} initialDraft={letter} /> : null}
    </>
  )
}
