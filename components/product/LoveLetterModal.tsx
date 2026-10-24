'use client'

import { type MouseEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  buildLoveLetterPreview,
  type LoveLetterDraft,
  type LoveLetterOccasionKey,
} from '@/lib/love-letter'
import { X } from 'lucide-react'
import { Select } from '@/components/ui/select'

type LoveLetterModalProps = {
  onClose: () => void
  onContinue: (draft: LoveLetterDraft) => void
  /** Opens the editor on an existing letter (the cart's Edit letter). */
  initialDraft?: LoveLetterDraft | null
}

type Step =
  | 'intro'
  | 'choice'
  | 'generate-name'
  | 'generate-words'
  | 'generate-occasion'
  | 'write'
  | 'preview'

const OCCASIONS: Array<{ value: LoveLetterOccasionKey; label: string }> = [
  { value: 'proposal', label: 'A marriage proposal' },
  { value: 'anniversary', label: 'An anniversary' },
  { value: 'birthday', label: 'A birthday' },
  { value: 'justbecause', label: 'No occasion, just love' },
  { value: 'apology', label: 'A reconciliation' },
  { value: 'mother', label: 'A gift for her mother' },
  { value: 'newchapter', label: 'A new chapter' },
]

const occasionOptions = OCCASIONS.map((occasion) => ({
  value: occasion.value,
  label: occasion.label,
}))

const choiceCards = [
  {
    id: 'generate_for_me',
    title: 'Generate for me',
    description: 'Answer a few private questions and we shape the note around your words.',
  },
  {
    id: 'write_myself',
    title: 'Write it myself',
    description: 'We print your exact message and place it neatly inside the box.',
  },
  {
    id: 'no_letter',
    title: 'No letter',
    description: 'Skip the card and continue straight to checkout.',
  },
] as const

const initialDraft: LoveLetterDraft = {
  wantsLetter: true,
  letterType: 'generate_for_me',
  recipientName: '',
  senderName: '',
  occasionKey: null,
  aboutHerText: '',
  customLetterText: '',
  finalLetterText: '',
  finalLetterHtml: '',
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#A67C22]">
      {children}
    </div>
  )
}

function GhostButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-none border border-[var(--theme-border)] bg-white px-5 py-3 text-[10px] font-medium uppercase tracking-[0.26em] text-[#5F6C7B] transition hover:border-[#0A1628] hover:text-[#0A1628] ${className}`}
    >
      {children}
    </button>
  )
}

function PrimaryButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-none bg-black px-5 py-3 text-[10px] font-medium uppercase tracking-[0.26em] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}

export default function LoveLetterModal({ onClose, onContinue, initialDraft: existingDraft }: LoveLetterModalProps) {
  const [step, setStep] = useState<Step>('intro')
  const [draft, setDraft] = useState<LoveLetterDraft>(existingDraft?.wantsLetter ? existingDraft : initialDraft)

  useEffect(() => {
    const scrollY = window.scrollY
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    const previousBodyPosition = document.body.style.position
    const previousBodyTop = document.body.style.top
    const previousBodyWidth = document.body.style.width

    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
      document.body.style.position = previousBodyPosition
      document.body.style.top = previousBodyTop
      document.body.style.width = previousBodyWidth
      window.scrollTo(0, scrollY)
    }
  }, [])

  const preview = useMemo(() => buildLoveLetterPreview(draft), [draft])

  const closeIfBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  const continueWithoutLetter = () => {
    onContinue({
      wantsLetter: false,
      letterType: 'no_letter',
      finalLetterText: '',
      finalLetterHtml: '',
    })
  }

  const continueWithLetter = () => {
    onContinue({
      ...draft,
      wantsLetter: true,
      finalLetterText: preview.text,
      finalLetterHtml: preview.html,
      recipientName: preview.recipientName || draft.recipientName || '',
      senderName: preview.senderName || draft.senderName || '',
    })
  }

  const canProceedFromName = (draft.recipientName || '').trim().length > 0
  const canProceedFromWords = (draft.aboutHerText || '').trim().length > 10
  const canProceedFromOccasion = Boolean(draft.occasionKey)
  const canProceedFromWrite =
    (draft.recipientName || '').trim().length > 0 &&
    (draft.customLetterText || '').trim().length > 10

  return (
    <div
      className="love-letter-modal fixed inset-0 z-[3100] flex items-start justify-center overflow-y-auto overscroll-none bg-black/25 px-2 py-2 sm:items-center sm:px-4 sm:py-6"
      onClick={closeIfBackdrop}
    >
      <div className="relative my-auto max-h-[calc(100dvh-16px)] w-full max-w-[780px] touch-pan-y overflow-y-auto overscroll-contain rounded-none border border-black/15 bg-white shadow-[0_24px_64px_rgba(0,0,0,0.16)] sm:max-h-[90vh] sm:rounded-none">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center border-0 bg-transparent text-black transition-colors hover:bg-black hover:text-white sm:right-4 sm:top-4 sm:h-9 sm:w-9"
        >
          <X size={19} strokeWidth={1.4} aria-hidden="true" />
        </button>

        {step === 'intro' ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center px-4 pb-8 pt-14 text-center sm:px-7 sm:py-10">
            <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.32em] text-[#A67C22]">
              Complimentary with every order
            </p>
            <h2 className="mt-4 max-w-[500px] font-display-title text-[clamp(28px,6vw,42px)] font-normal leading-[1] text-[#0A1628]">
              Add a private love letter
            </h2>
            <p className="mt-4 max-w-[460px] text-[13px] leading-6 text-[#5F6C7B] sm:text-[14px]">
              We can place a printed note inside the box so the gift feels even more personal.
            </p>
            <div className="mt-8 flex w-full max-w-[420px] flex-col gap-3 sm:flex-row sm:justify-center">
              <PrimaryButton type="button" onClick={() => setStep('choice')} className="w-full sm:w-auto">
                Continue
              </PrimaryButton>
              <GhostButton type="button" onClick={continueWithoutLetter} className="w-full sm:w-auto">
                Skip for now
              </GhostButton>
            </div>
          </div>
        ) : null}

        {step === 'choice' ? (
          <div className="px-4 pb-8 pt-14 sm:px-7 sm:py-10">
            <div className="mx-auto max-w-[520px] text-center">
              <SectionLabel>Your Letter</SectionLabel>
              <h3 className="mt-4 font-display-title text-[clamp(26px,4vw,36px)] font-normal leading-[1.04] text-[#0A1628]">
                Choose how you want to do it
              </h3>
              <p className="mt-4 text-[12px] leading-6 text-[#5F6C7B] sm:text-[13px]">
                Pick the option that feels most natural. You will preview it before checkout.
              </p>
            </div>
            <div className="mx-auto mt-6 grid max-w-[680px] gap-2.5 sm:mt-7 sm:gap-4 md:grid-cols-3">
              {choiceCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => {
                    if (card.id === 'generate_for_me') {
                      setDraft((current) => ({
                        ...current,
                        wantsLetter: true,
                        letterType: 'generate_for_me',
                      }))
                      setStep('generate-name')
                      return
                    }

                    if (card.id === 'write_myself') {
                      setDraft((current) => ({
                        ...current,
                        wantsLetter: true,
                        letterType: 'write_myself',
                        occasionKey: 'justbecause',
                      }))
                      setStep('write')
                      return
                    }

                    continueWithoutLetter()
                  }}
                  className="w-full rounded-none border border-[rgba(10,22,40,0.1)] bg-[rgba(255,255,255,0.82)] px-4 py-4 text-left transition hover:border-[rgba(166,124,34,0.34)] hover:bg-white sm:rounded-none sm:px-4 sm:py-5"
                >
                  <div className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#A67C22]">
                    Option
                  </div>
                  <div className="mt-2.5 font-display-title text-[18px] leading-[1.02] text-[#0A1628] sm:mt-3 sm:text-[21px] sm:leading-none">
                    {card.title}
                  </div>
                  <p className="mt-2.5 text-[11px] leading-5 text-[#5F6C7B] sm:mt-3 sm:text-[12px] sm:leading-6">
                    {card.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 'generate-name' ? (
          <div className="mx-auto max-w-[560px] px-4 pb-8 pt-14 sm:px-7 sm:py-10">
            <SectionLabel>Question 01 of 03</SectionLabel>
            <h3 className="mt-4 font-display-title text-[clamp(26px,4vw,34px)] font-normal leading-[1.05] text-[#0A1628]">
              What is her name?
            </h3>
            <p className="mt-4 text-[12px] leading-6 text-[#5F6C7B] sm:text-[13px]">
              Use the name you call her. It does not need to be formal.
            </p>
            <input
              value={draft.recipientName || ''}
              onChange={(event) =>
                setDraft((current) => ({ ...current, recipientName: event.target.value }))
              }
              placeholder="Her name"
              className="mt-7 w-full rounded-none border border-[rgba(10,22,40,0.1)] bg-white px-5 py-3.5 text-center font-serif text-[22px] text-[#0A1628] outline-none placeholder:text-[#BFC3CA] sm:text-[24px]"
            />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <GhostButton type="button" onClick={() => setStep('choice')} className="w-full sm:w-auto">
                Back
              </GhostButton>
              <PrimaryButton
                type="button"
                onClick={() => setStep('generate-words')}
                disabled={!canProceedFromName}
                className="w-full sm:w-auto"
              >
                Next
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        {step === 'generate-words' ? (
          <div className="mx-auto max-w-[560px] px-4 pb-8 pt-14 sm:px-7 sm:py-10">
            <SectionLabel>Question 02 of 03</SectionLabel>
            <h3 className="mt-4 font-display-title text-[clamp(26px,4vw,34px)] font-normal leading-[1.05] text-[#0A1628]">
              Who is she to you?
            </h3>
            <p className="mt-4 text-[12px] leading-6 text-[#5F6C7B] sm:text-[13px]">
              Write naturally. We will refine the tone, but the meaning stays yours.
            </p>
            <textarea
              value={draft.aboutHerText || ''}
              onChange={(event) =>
                setDraft((current) => ({ ...current, aboutHerText: event.target.value }))
              }
              placeholder="She is the person who..."
              maxLength={300}
              className="mt-7 min-h-[150px] w-full rounded-none border border-[rgba(10,22,40,0.1)] bg-white px-4 py-4 font-serif text-[17px] leading-7 text-[#0A1628] outline-none placeholder:text-[#BFC3CA]"
            />
            <div className="mt-3 text-right text-[10px] uppercase tracking-[0.12em] text-[#8A92A0]">
              {(draft.aboutHerText || '').length} / 300
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <GhostButton type="button" onClick={() => setStep('generate-name')} className="w-full sm:w-auto">
                Back
              </GhostButton>
              <PrimaryButton
                type="button"
                onClick={() => setStep('generate-occasion')}
                disabled={!canProceedFromWords}
                className="w-full sm:w-auto"
              >
                Next
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        {step === 'generate-occasion' ? (
          <div className="mx-auto max-w-[560px] px-4 pb-8 pt-14 sm:px-7 sm:py-10">
            <SectionLabel>Question 03 of 03</SectionLabel>
            <h3 className="mt-4 font-display-title text-[clamp(26px,4vw,34px)] font-normal leading-[1.05] text-[#0A1628]">
              What is this moment about?
            </h3>
            <p className="mt-4 text-[12px] leading-6 text-[#5F6C7B] sm:text-[13px]">
              This helps us set the emotional tone of the letter.
            </p>
            <div className="mt-7">
              <Select
                value={draft.occasionKey || ''}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    occasionKey: (value || null) as LoveLetterOccasionKey | null,
                  }))
                }
                options={occasionOptions}
                placeholder="Select an occasion"
                triggerClassName="rounded-none border-[rgba(10,22,40,0.1)] bg-white px-4 py-3 text-[13px] text-[#0A1628] shadow-none focus:shadow-[0_12px_28px_rgba(10,22,40,0.08)]"
                contentClassName="rounded-none"
                validationLabel="Occasion"
                contentSide="bottom"
                avoidCollisions={false}
              />
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <GhostButton type="button" onClick={() => setStep('generate-words')} className="w-full sm:w-auto">
                Back
              </GhostButton>
              <PrimaryButton
                type="button"
                onClick={() => setStep('preview')}
                disabled={!canProceedFromOccasion}
                className="w-full sm:w-auto"
              >
                Preview letter
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        {step === 'write' ? (
          <div className="mx-auto max-w-[620px] px-4 pb-8 pt-14 sm:px-7 sm:py-10">
            <SectionLabel>Your Letter</SectionLabel>
            <h3 className="mt-4 font-display-title text-[clamp(26px,4vw,34px)] font-normal leading-[1.05] text-[#0A1628]">
              Write it yourself
            </h3>
            <p className="mt-4 text-[12px] leading-6 text-[#5F6C7B] sm:text-[13px]">
              We will print your own words beautifully and place them inside the box.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <input
                value={draft.recipientName || ''}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, recipientName: event.target.value }))
                }
                placeholder="Her name"
                className="rounded-none border border-[rgba(10,22,40,0.1)] bg-white px-4 py-3 text-[14px] text-[#0A1628] outline-none placeholder:text-[#BFC3CA]"
              />
              <input
                value={draft.senderName || ''}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, senderName: event.target.value }))
                }
                placeholder="Your name"
                className="rounded-none border border-[rgba(10,22,40,0.1)] bg-white px-4 py-3 text-[14px] text-[#0A1628] outline-none placeholder:text-[#BFC3CA]"
              />
            </div>
            <textarea
              value={draft.customLetterText || ''}
              onChange={(event) =>
                setDraft((current) => ({ ...current, customLetterText: event.target.value }))
              }
              placeholder="Write your letter here..."
              maxLength={800}
              className="mt-4 min-h-[200px] w-full rounded-none border border-[rgba(10,22,40,0.1)] bg-white px-4 py-4 font-serif text-[17px] leading-7 text-[#0A1628] outline-none placeholder:text-[#BFC3CA]"
            />
            <div className="mt-3 text-right text-[10px] uppercase tracking-[0.12em] text-[#8A92A0]">
              {(draft.customLetterText || '').length} / 800
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <GhostButton type="button" onClick={() => setStep('choice')} className="w-full sm:w-auto">
                Back
              </GhostButton>
              <PrimaryButton
                type="button"
                onClick={() => setStep('preview')}
                disabled={!canProceedFromWrite}
                className="w-full sm:w-auto"
              >
                Preview letter
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        {step === 'preview' ? (
          <div className="grid gap-0 xl:grid-cols-[250px_1fr]">
            <div className="order-2 border-t border-[rgba(10,22,40,0.08)] bg-[rgba(255,255,255,0.48)] px-4 pb-7 pt-6 sm:px-6 sm:py-7 xl:order-1 xl:border-b-0 xl:border-t-0 xl:border-r">
              <SectionLabel>Final Review</SectionLabel>
              <h3 className="mt-4 font-display-title text-[24px] leading-[1.05] text-[#0A1628]">
                Review the note
              </h3>
              <p className="mt-3 text-[12px] leading-6 text-[#5F6C7B]">
                Check the details once more, then continue to checkout.
              </p>

              <div className="mt-7 space-y-5 text-sm text-[#344054]">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-[#A67C22]">
                    Recipient
                  </div>
                  <div
                    className="mt-2 text-[18px] font-medium text-[#0A1628]"
                    style={{ fontFamily: 'Manrope, var(--font-geist-sans), sans-serif' }}
                  >
                    {draft.recipientName || '-'}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-[#A67C22]">
                    Signed from
                  </div>
                  <input
                    value={draft.senderName || ''}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, senderName: event.target.value }))
                    }
                    placeholder="Your name"
                    className="mt-2 w-full rounded-none border border-[rgba(10,22,40,0.1)] bg-white px-4 py-3 text-[13px] text-[#0A1628] outline-none placeholder:text-[#BFC3CA]"
                  />
                </div>

                {draft.letterType === 'generate_for_me' ? (
                  <>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.24em] text-[#A67C22]">
                        About her
                      </div>
                      <div className="mt-2 text-[13px] leading-6 text-[#5F6C7B]">
                        {draft.aboutHerText || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.24em] text-[#A67C22]">
                        Occasion
                      </div>
                      <div className="mt-2 text-[13px] text-[#5F6C7B]">
                        {OCCASIONS.find((entry) => entry.value === draft.occasionKey)?.label ||
                          '-'}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <GhostButton
                  type="button"
                  onClick={() =>
                    setStep(draft.letterType === 'write_myself' ? 'write' : 'generate-occasion')
                  }
                  className="w-full"
                >
                  Edit
                </GhostButton>
                <PrimaryButton
                  type="button"
                  onClick={continueWithLetter}
                  className="w-full"
                >
                  Continue to checkout
                </PrimaryButton>
              </div>
            </div>

            <div className="order-1 px-4 pb-6 pt-14 sm:px-6 sm:py-8 xl:order-2 xl:pt-8">
              <div
                className="mx-auto max-w-[410px] rounded-none border border-[rgba(10,22,40,0.1)] bg-white px-5 py-6 shadow-[0_14px_34px_rgba(10,22,40,0.08)] sm:px-6 sm:py-7"
                style={{ fontFamily: 'Manrope, var(--font-geist-sans), sans-serif' }}
              >
                <div className="text-[11px] italic tracking-[0.08em] text-[#8A92A0]">
                  House of Diams
                </div>
                <div className="mt-4 text-[22px] font-medium text-[#0A1628] sm:text-[24px]">
                  Dear <em>{draft.recipientName || 'Her'}</em>,
                </div>
                <div className="mt-6 h-px w-10 bg-[rgba(166,124,34,0.35)]" />
                <div
                  className="prose prose-neutral mt-5 max-w-none text-[14px] font-normal leading-[1.85] text-[#292727] [&_p]:mb-4"
                  dangerouslySetInnerHTML={{
                    __html: preview.html || '<p>Your letter preview will appear here.</p>',
                  }}
                />
                <div className="mt-8 h-px w-10 bg-[rgba(166,124,34,0.35)]" />
                <div className="mt-4 text-[12px] italic text-[#8A92A0]">Yours, always</div>
                <div className="mt-2 text-[20px] font-medium italic text-[#0A1628]">
                  {draft.senderName || '-'}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
