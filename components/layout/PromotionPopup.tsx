'use client'

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Copy } from 'lucide-react'
import { cinzelFont } from '@/app/fonts'
import { mediaUrl } from '@/lib/media-url'

type PromotionOption = string | { id?: string | number; value?: string; label?: string }
type PromotionQuestion = { id: number; field_key: string; question: string; input_type: 'text' | 'email' | 'phone' | 'number' | 'options'; options?: PromotionOption[] | null; allow_multiple?: boolean; validation_pattern?: string | null; validation_message?: string | null; is_required: boolean; sort_order: number }
type PromotionAnswers = Record<string, string | string[]>

function optionValue(option: PromotionOption, index: number) {
  return typeof option === 'string' ? option : option.value ?? option.label ?? String(option.id ?? index)
}

function optionLabel(option: PromotionOption, index: number) {
  return typeof option === 'string' ? option : option.label ?? option.value ?? String(option.id ?? index)
}

type PromotionPopupData = {
  label: string
  title: string
  description: string
  cta_text: string
  cta_link: string
  cta_action?: 'redirect' | 'reveal_coupon'
  selected_coupon_id?: number | null
  image_path?: string
  mobile_image_path?: string
  image_alt?: string
  image_only_mode?: boolean
  is_active: boolean
  show_once_per_session: boolean
  updated_at?: string
  questions?: PromotionQuestion[]
}

const SESSION_KEY = 'hod_promotion_popup_shown_v3'

function buildVersionToken(item: PromotionPopupData) {
  return (
    item.updated_at ||
    [
      item.label,
      item.title,
      item.description,
      item.cta_text,
      item.cta_link,
      item.cta_action,
      item.selected_coupon_id,
      item.image_path,
      item.mobile_image_path,
      item.image_alt,
      item.image_only_mode ? '1' : '0',
      item.is_active ? '1' : '0',
    ].join('|')
  )
}

function toPublicUrl(path: string) {
  return mediaUrl(path)
}

function appendCacheBuster(src: string, versionToken: string) {
  if (!src) return ''
  const separator = src.includes('?') ? '&' : '?'
  return `${src}${separator}v=${encodeURIComponent(versionToken)}`
}

export default function PromotionPopup() {
  const [item, setItem] = useState<PromotionPopupData | null>(null)
  const [visible, setVisible] = useState(false)
  const [answers, setAnswers] = useState<PromotionAnswers>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [revealedCoupon, setRevealedCoupon] = useState<{ code: string; title?: string | null } | null>(null)
  const [redirectUrl, setRedirectUrl] = useState('')
  const [couponCopied, setCouponCopied] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [updatesOptIn, setUpdatesOptIn] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const itemRef = useRef<PromotionPopupData | null>(null)

  useEffect(() => {
    let active = true
    const loadPromotion = async () => {
      try {
        const response = await fetch('/api/public/promotion-popup', { cache: 'no-store' })
        const payload = await response.json().catch(() => null)
        const nextItem = payload?.item as PromotionPopupData | null
        if (!response.ok || !nextItem?.is_active || nextItem.cta_action !== 'reveal_coupon' || !nextItem.selected_coupon_id) return null
        if (active) {
          itemRef.current = nextItem
          setItem(nextItem)
        }
        return nextItem
      } catch {
        return null
      }
    }
    void loadPromotion()
    const openFromOffer = async () => {
      const nextItem = itemRef.current || await loadPromotion()
      if (!nextItem || !active) return
      // A deliberate click is never blocked by the automatic show-once gate.
      itemRef.current = nextItem
      setItem(nextItem)
      setAnswers({})
      setSubmitError('')
      setCurrentStep(0)
      setRevealedCoupon(null)
      setCouponCopied(false)
      setImageFailed(false)
      setVisible(true)
    }
    window.addEventListener('hod:open-coupon-offer', openFromOffer)
    return () => {
      active = false
      window.removeEventListener('hod:open-coupon-offer', openFromOffer)
    }
  }, [])

  const close = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(SESSION_KEY, '1')
      document.body.style.overflow = ''
    }
    setVisible(false)
  }

  useEffect(() => {
    if (!visible) return
    const previous = document.body.style.overflow
    const previouslyFocused = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus(), 0)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]')]
      if (!focusable.length) return
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus() }
      if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
      previouslyFocused?.focus()
    }
  }, [visible])

  if (!item || !visible) return null

  const versionToken = buildVersionToken(item)
  const imageSrc = appendCacheBuster(toPublicUrl(item.image_path || ''), versionToken)
  const mobileImageSrc = appendCacheBuster(toPublicUrl(item.mobile_image_path || item.image_path || ''), versionToken)
  const useTextOnlyLayout = true
  const questions = item.questions?.length ? item.questions : [{ id: 0, field_key: 'email', question: 'What is your email address?', input_type: 'email' as const, is_required: true, sort_order: 0 }]
  const submitAnswers = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const currentQuestion = questions[currentStep]
    const currentAnswer = answers[currentQuestion.field_key]
    const hasAnswer = Array.isArray(currentAnswer) ? currentAnswer.length > 0 : Boolean(currentAnswer?.trim())
    if (currentQuestion.is_required && !hasAnswer) {
      setSubmitError(currentQuestion.validation_message || `${currentQuestion.question} is required.`)
      return
    }
    setSubmitError('')
    if (currentStep < questions.length - 1) { setCurrentStep((step) => step + 1); return }
    if (isSubmitting) return
    setIsSubmitting(true)
    setSubmitError('')
    try {
      const response = await fetch('/api/public/promotion-popup/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const payload = await response.json().catch(() => null) as { error?: string; action?: string; redirectUrl?: string; coupon?: { code: string; title?: string | null } } | null
      if (!response.ok) throw new Error(payload?.error || 'Unable to submit your answers.')
      if (payload?.action === 'reveal_coupon' && payload.coupon?.code) {
        setRevealedCoupon(payload.coupon)
        return
      }
      if (payload?.redirectUrl) setRedirectUrl(payload.redirectUrl)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit your answers.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const emailAction = revealedCoupon ? (
    <div className="mt-6 rounded-[10px] border border-[rgba(10,22,40,0.14)] bg-white px-4 py-4 text-center" aria-live="polite">
      <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[rgba(10,22,40,0.48)]">Your coupon code</p>
      {revealedCoupon.title ? <p className="mt-2 text-[12px] text-[rgba(10,22,40,0.62)]">{revealedCoupon.title}</p> : null}
      <div className="mt-3 flex items-stretch gap-2">
        <strong className="flex min-h-[44px] flex-1 items-center justify-center border border-dashed border-[rgba(10,22,40,0.28)] bg-[#f4f6f8] px-3 text-[15px] tracking-[0.12em] text-[var(--theme-ink)]">{revealedCoupon.code}</strong>
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(revealedCoupon.code); setCouponCopied(true); window.setTimeout(() => setCouponCopied(false), 2500) } catch { setCouponCopied(false) } }} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center bg-[var(--theme-ink)] px-3 text-white transition hover:bg-[#182a45]" aria-label="Copy coupon code" title="Copy coupon code">{couponCopied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}</button>
      </div>
      <p className={`mt-2 min-h-4 text-[10px] font-medium transition-opacity ${couponCopied ? 'text-[#35634a] opacity-100' : 'opacity-0'}`} aria-live="polite">Copied to clipboard</p>
    </div>
  ) : redirectUrl ? (
    <div className="mt-6" aria-live="polite">
      <p className="mb-3 text-[11px] leading-5 text-[rgba(10,22,40,0.58)]">Thank you. Your offer is ready.</p>
      <a href={redirectUrl} onClick={close} className="inline-flex min-h-[46px] w-full items-center justify-center bg-[var(--theme-ink)] px-5 text-[10px] font-medium uppercase tracking-[0.16em] text-white transition hover:bg-[#182a45] sm:min-h-[48px] sm:text-[11px]">{item.cta_text || 'Continue'}</a>
    </div>
  ) : (
    <form onSubmit={submitAnswers} className="mt-6 space-y-3" noValidate>
      <div className="mb-5 flex gap-1.5" aria-label={`Step ${Math.min(currentStep + 1, questions.length)} of ${questions.length}`}>{questions.map((question, index) => <span key={question.field_key} className={`h-1 flex-1 ${index <= currentStep ? 'bg-black' : 'bg-black/15'}`} />)}</div>
      {questions.slice(currentStep, currentStep + 1).map((question) => (
        <div key={question.field_key}>
          <label htmlFor={`promotion-${question.field_key}`} className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-[rgba(10,22,40,0.62)]">{question.question}{question.is_required ? ' *' : ''}</label>
          {question.input_type === 'options' && question.options?.length ? <div className="grid gap-2" role={question.allow_multiple ? "group" : "radiogroup"}>{question.options.map((option, optionIndex) => { const value = optionValue(option, optionIndex); const selected = question.allow_multiple ? (Array.isArray(answers[question.field_key]) && answers[question.field_key].includes(value)) : answers[question.field_key] === value; return <label key={typeof option === 'string' ? option : option.id ?? value} className="flex min-h-12 items-center gap-3 border border-[#eaecf0] bg-white px-4 py-2 text-left font-[family-name:var(--font-family-secondary)] text-sm font-medium text-[#101828]"><input type={question.allow_multiple ? "checkbox" : "radio"} name={question.field_key} value={value} checked={selected} onChange={(event) => setAnswers((current) => question.allow_multiple ? ({ ...current, [question.field_key]: event.target.checked ? [...(Array.isArray(current[question.field_key]) ? current[question.field_key] : []), value] : ((Array.isArray(current[question.field_key]) ? current[question.field_key] : []) as string[]).filter((item) => item !== value) }) : ({ ...current, [question.field_key]: value }))} className="h-3.5 w-3.5 accent-black" required={question.is_required} /><span>{optionLabel(option, optionIndex)}</span></label> })}</div> : <div className="border border-[#eaecf0] bg-white px-4 py-2"><input id={`promotion-${question.field_key}`} type={question.input_type === 'phone' ? 'tel' : question.input_type === 'options' ? 'text' : question.input_type} required={question.is_required} pattern={question.validation_pattern || undefined} value={typeof answers[question.field_key] === 'string' ? answers[question.field_key] : ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.field_key]: event.target.value }))} className="checkout-input h-7 w-full border-0 bg-transparent p-0 text-sm font-medium text-[#101828] outline-none placeholder:text-[#98a2b3]" /></div>}
        </div>
      ))}
      <div className="flex gap-2">{currentStep > 0 ? <button type="button" onClick={() => { setSubmitError(''); setCurrentStep((step) => Math.max(0, step - 1)) }} className="inline-flex min-h-[44px] w-11 shrink-0 items-center justify-center border border-black/25 bg-white text-black transition hover:border-black sm:min-h-[46px]" aria-label="Go to previous step"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></button> : null}<button type="submit" disabled={isSubmitting} className="inline-flex min-h-[44px] flex-1 items-center justify-center border border-black bg-black px-5 text-[10px] font-medium uppercase tracking-[0.16em] text-white transition disabled:cursor-wait disabled:opacity-65 hover:bg-white hover:text-black sm:min-h-[46px]">{isSubmitting ? 'Submitting…' : currentStep < questions.length - 1 ? 'Next' : item.cta_action === 'reveal_coupon' ? 'Reveal my code' : 'Submit'}</button></div>
      <label className="mt-3 flex items-start gap-2 text-left font-[family-name:var(--font-family-secondary)] text-[10px] leading-4 text-black/55"><input type="checkbox" checked={updatesOptIn} onChange={(event) => setUpdatesOptIn(event.target.checked)} className="mt-0.5 h-3 w-3 shrink-0 accent-black" /><span>Send me jewellery guides and updates.</span></label>
      {submitError ? <p className="text-[11px] leading-4 text-[#9f2f2f]" role="alert">{submitError}</p> : null}
    </form>
  )

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-[rgba(10,22,40,0.48)] p-3 backdrop-blur-[6px] sm:p-5">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Promotion offer" className="relative max-h-[calc(100vh-24px)] w-full max-w-[calc(100vw-24px)] overflow-hidden rounded-none border border-black/12 bg-white sm:max-h-[calc(100vh-40px)] sm:max-w-[760px] sm:rounded-[12px]">
        <button
          type="button"
          onClick={close}
          aria-label="Close promotion popup"
          className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(10,22,40,0.14)] bg-white text-[var(--theme-ink)] transition hover:bg-white hover:scale-[1.04] sm:right-4 sm:top-4 sm:h-9 sm:w-9"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>

        {useTextOnlyLayout ? (
          <div className="flex min-h-[380px] items-center justify-center overflow-y-auto bg-white px-7 py-14 sm:min-h-[480px] sm:px-16 sm:py-20">
            <div className="w-full max-w-[480px] text-left">
              {item.label ? <p className="mb-4 text-[10px] uppercase tracking-[0.28em] text-[rgba(10,22,40,0.45)]">{item.label}</p> : null}
              <h2 className={`${cinzelFont.variable} font-primary-display text-left text-[clamp(1.5rem,4vw,2.35rem)] leading-[1.05] tracking-[-0.03em] text-[var(--theme-ink)]`}>{item.title}</h2>
              {item.description ? <p className="mx-auto mt-6 max-w-[40ch] text-[14px] leading-7 text-[rgba(10,22,40,0.64)] sm:text-[16px]">{item.description}</p> : null}
              {emailAction}
            </div>
          </div>
        ) : (
          <div className="grid max-h-[calc(100vh-24px)] min-h-[250px] grid-cols-1 overflow-y-auto md:max-h-none md:grid-cols-[0.94fr_1.06fr] md:overflow-hidden sm:min-h-[420px]">
            <div className="relative h-[46vh] max-h-[360px] min-h-[240px] bg-[radial-gradient(circle_at_top,#f7f8fa_0%,#e7eaee_46%,#cfd5dd_100%)] md:h-auto md:max-h-none md:min-h-full">
              {imageSrc ? (
                <picture>
                  <source media="(max-width: 767px)" srcSet={mobileImageSrc} />
                  <img
                    src={imageSrc}
                    alt={item.image_alt || item.title || 'Promotion image'}
                    className="absolute inset-0 h-full w-full object-cover object-center"
                    loading="eager"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                      setImageFailed(true)
                    }}
                  />
                </picture>
              ) : (
                <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#f6f7f9_0%,#dce1e7_100%)] p-8 text-center text-[13px] uppercase tracking-[0.24em] text-[rgba(10,22,40,0.5)]">
                  Promotion Image
                </div>
              )}
            </div>

            <div className="flex min-h-full items-center justify-center bg-white px-5 py-5 sm:px-9 sm:py-8 md:px-10">
              <div className="w-full max-w-[240px] text-left sm:max-w-[300px]">
                {item.label ? (
                  <p className="mb-3 text-[9px] uppercase tracking-[0.22em] text-[rgba(10,22,40,0.42)] sm:mb-4 sm:text-[10px] sm:tracking-[0.26em]">
                    {item.label}
                  </p>
                ) : null}

                <h2
                  className={`${cinzelFont.variable} font-primary-display text-left text-[var(--theme-ink)] text-[clamp(1.25rem,5vw,1.85rem)] sm:text-[clamp(1.75rem,3vw,2.75rem)]`}
                  style={{
                    lineHeight: 1.05,
                    letterSpacing: '-0.025em',
                  }}
                >
                  {item.title}
                </h2>

                <p className="mx-auto mt-3 max-w-[24ch] text-[12px] leading-5 text-[rgba(10,22,40,0.62)] sm:mt-5 sm:max-w-[28ch] sm:text-[15px] sm:leading-7">
                  {item.description}
                </p>

                {emailAction}

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
