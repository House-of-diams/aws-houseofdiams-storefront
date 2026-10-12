'use client'

import { useEffect, useRef, useState } from 'react'
import { Mail, MapPin, Phone, X } from 'lucide-react'
import { useContactDrawer } from '@/lib/hooks/useContactDrawer'
import { useCart } from '@/lib/hooks/useCart'
import { useToast } from '@/components/home/Toast'
import { getSafeContactHref } from '@/lib/contact-links'
import { fetchPublicJson } from '@/lib/client/public-json'

type ContactRow = { id?: number | string | null; label?: string | null; value?: string | null; note?: string | null; href?: string | null }
const FALLBACK_ROWS: ContactRow[] = [
  { id: 'email', label: 'Email', value: 'info@houseofdiams.com', href: 'mailto:info@houseofdiams.com' },
  { id: 'phone', label: 'Phone & WhatsApp', value: '+91 93285 36178', href: 'tel:+919328536178' },
  { id: 'address', label: 'Address', value: '36 W 44th Street, Suite 1000B, New York, 10036, USA' },
]
const fieldClass = 'h-11 w-full border border-black/20 bg-white px-3 font-[family-name:var(--font-family-inter)] text-[12px] text-black outline-none transition focus:border-black'

function RowIcon({ label }: { label: string }) {
  if (/email/i.test(label)) return <Mail size={18} strokeWidth={1.35} />
  if (/phone|whatsapp/i.test(label)) return <Phone size={18} strokeWidth={1.35} />
  return <MapPin size={18} strokeWidth={1.35} />
}

export default function ContactDrawer() {
  const { isOpen, closeContact } = useContactDrawer()
  const { closeCart } = useCart()
  const { showToast } = useToast()
  const panelRef = useRef<HTMLElement>(null)
  const [rows, setRows] = useState<ContactRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', topic: '', message: '' })

  useEffect(() => {
    if (!isOpen) return
    closeCart()
    if (!loaded) {
      void fetchPublicJson<{ items?: ContactRow[] }>('/api/public/contact/info').then(({ ok, payload }) => {
        if (ok && Array.isArray(payload?.items)) setRows(payload.items)
      }).catch(() => {}).finally(() => setLoaded(true))
    }
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    window.requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('[data-contact-close]')?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { closeContact(); return }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [closeCart, closeContact, isOpen, loaded])

  const contactRows = rows.length ? rows.filter((row) => row.value?.trim()) : FALLBACK_ROWS
  const setField = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/public/contact/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ full_name: form.name, email: form.email, phone: form.phone, topic: form.topic, message: form.message }) })
      if (!response.ok) throw new Error('Unable to submit your request.')
      setForm({ name: '', email: '', phone: '', topic: '', message: '' })
      showToast('Thanks - your request was submitted successfully.')
    } catch {
      showToast('Sorry, we could not submit your request just now.')
    } finally {
      setSubmitting(false)
    }
  }

  return <div className={`fixed inset-0 z-[3000] transition-[visibility] duration-300 ${isOpen ? 'visible' : 'invisible'}`} aria-hidden={!isOpen}>
    <button type="button" aria-label="Close contact" tabIndex={isOpen ? 0 : -1} onClick={closeContact} className={`absolute inset-0 h-full w-full border-0 bg-black/25 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
    <aside ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="contact-drawer-title" className={`absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col bg-white text-black shadow-[-16px_0_42px_rgba(0,0,0,.16)] transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/15 px-4 sm:px-5"><h2 id="contact-drawer-title" className="font-[family-name:var(--font-family-montserrat)] text-[15px] font-semibold uppercase tracking-[.04em]">Contact Us</h2><button data-contact-close type="button" onClick={closeContact} aria-label="Close contact" className="flex h-9 w-9 items-center justify-center bg-transparent transition-colors hover:bg-black hover:text-white"><X size={19} strokeWidth={1.4} /></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-5">
        <section aria-labelledby="contact-details-heading"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-black/50">We are here to help</p><h3 id="contact-details-heading" className="mt-2 font-[family-name:var(--font-family-montserrat)] text-[22px] font-semibold leading-tight">Speak with House of Diams</h3><div className="mt-5 divide-y divide-black/10 border-y border-black/10">{contactRows.map((row, index) => { const label = row.label?.trim() || 'Contact'; const value = row.value?.trim(); const href = getSafeContactHref(row.href); if (!value) return null; const content = <><span className="block font-[family-name:var(--font-family-montserrat)] text-[10px] font-semibold uppercase tracking-[.1em] text-black/50">{label}</span><span className="mt-1 block text-[13px] leading-5 text-black">{value}</span>{row.note?.trim() ? <span className="mt-1 block text-[11px] leading-4 text-black/55">{row.note.trim()}</span> : null}</>; return <div key={row.id ?? `${label}-${index}`} className="grid grid-cols-[38px_1fr] gap-3 py-4"><span className="flex h-9 w-9 items-center justify-center border border-black/15"><RowIcon label={label} /></span>{href ? <a href={href} className="min-w-0 no-underline">{content}</a> : <div className="min-w-0">{content}</div>}</div> })}</div></section>
        <section className="mt-8 border-t border-black/15 pt-7" aria-labelledby="contact-form-heading"><h3 id="contact-form-heading" className="font-[family-name:var(--font-family-montserrat)] text-[17px] font-semibold uppercase tracking-[.04em]">Send an enquiry</h3><p className="mt-2 text-[11px] leading-5 text-black/55">Our team normally replies within 24 hours.</p><form onSubmit={submit} className="mt-5 grid gap-3"><input required value={form.name} onChange={(event) => setField('name', event.target.value)} className={fieldClass} placeholder="Full name" aria-label="Full name" /><input required type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} className={fieldClass} placeholder="Email address" aria-label="Email address" /><input value={form.phone} onChange={(event) => setField('phone', event.target.value)} className={fieldClass} placeholder="Phone / WhatsApp (optional)" aria-label="Phone or WhatsApp" /><select required value={form.topic} onChange={(event) => setField('topic', event.target.value)} className={fieldClass} aria-label="Enquiry topic"><option value="">Select enquiry topic</option><option>Product Enquiry</option><option>Bespoke Order</option><option>B2B Wholesale</option><option>Press / Media</option><option>General Enquiry</option></select><textarea required rows={5} value={form.message} onChange={(event) => setField('message', event.target.value)} className={`${fieldClass} h-auto min-h-[120px] resize-y py-3`} placeholder="Your message" aria-label="Your message" /><button type="submit" disabled={submitting} className="mt-1 flex h-11 items-center justify-center bg-black px-6 font-[family-name:var(--font-family-montserrat)] text-[10px] font-semibold uppercase tracking-[.08em] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Sending…' : 'Send Message'}</button></form></section>
      </div>
    </aside>
  </div>
}
