'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { CONSENT_ACCEPTED, CONSENT_REJECTED, type ConsentChoice } from '@/lib/consent'
import { saveConsent, subscribeToConsentOpen, useConsent } from '@/lib/consent-client'

const OPTIONS: { key: keyof ConsentChoice; title: string; body: string; cookies: string }[] = [
  {
    key: 'analytics',
    title: 'Analytics',
    body: 'Helps us understand which pages are visited and how the site is used, so we can improve it. The data is aggregated.',
    cookies: 'Google Analytics and Google Tag Manager (_ga, _ga_*, _gid)',
  },
  {
    key: 'marketing',
    title: 'Marketing',
    body: 'Lets us measure our advertising campaigns and show you relevant offers on other websites.',
    cookies: 'Advertising and conversion tags loaded through Google Tag Manager (_gcl_*)',
  },
]

export default function CookieBanner() {
  const consent = useConsent()
  const [forcedOpen, setForcedOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [customize, setCustomize] = useState(false)
  const [draft, setDraft] = useState<ConsentChoice | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => subscribeToConsentOpen(() => { setLeaving(false); setCustomize(true); setForcedOpen(true) }), [])
  useEffect(() => { if (forcedOpen) dialogRef.current?.focus() }, [forcedOpen])

  const undecided = consent === null
  const rendered = consent !== undefined && (undecided || forcedOpen || leaving)
  if (!rendered) return null

  const values: ConsentChoice = draft ?? { analytics: consent?.analytics ?? false, marketing: consent?.marketing ?? false }

  const decide = (choice: ConsentChoice) => {
    setLeaving(true)
    saveConsent(choice)
  }
  const finishExit = () => {
    if (!leaving) return
    setLeaving(false)
    setForcedOpen(false)
    setCustomize(false)
    setDraft(null)
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="hod-consent-title"
      aria-describedby="hod-consent-text"
      tabIndex={-1}
      className={`hod-consent${leaving ? ' hod-consent-leaving' : ''}`}
      onAnimationEnd={finishExit}
    >
      <style>{`
        .hod-consent { position: fixed; z-index: 2000; left: 0; right: 0; bottom: 0; max-height: min(88vh, 640px); overflow-y: auto; box-sizing: border-box; background: #fff; color: #0A1628; border-top: 1px solid rgba(10,22,40,.12); box-shadow: 0 -12px 40px rgba(10,22,40,.16); padding: 20px 16px calc(20px + env(safe-area-inset-bottom)); font-family: var(--font-family-montserrat), system-ui, sans-serif; outline: none; animation: hod-consent-in .5s cubic-bezier(.22,1,.36,1) both; }
        .hod-consent-leaving { animation: hod-consent-out .38s cubic-bezier(.55,0,.8,.2) both; pointer-events: none; }
        @keyframes hod-consent-in { from { transform: translateY(105%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes hod-consent-out { from { transform: translateY(0); opacity: 1; } to { transform: translateY(105%); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .hod-consent { animation: hod-consent-fade-in .15s linear both; }
          .hod-consent-leaving { animation: hod-consent-fade-out .15s linear both; }
          @keyframes hod-consent-fade-in { from { opacity: 0; } to { opacity: 1; } }
          @keyframes hod-consent-fade-out { from { opacity: 1; } to { opacity: 0; } }
        }
        @media (min-width: 769px) {
          .hod-consent { left: 24px; right: auto; bottom: 24px; width: 460px; border: 1px solid rgba(10,22,40,.12); padding: 24px; }
        }
        .hod-consent h2 { margin: 0 0 8px; font-size: 16px; font-weight: 600; letter-spacing: .02em; }
        .hod-consent p { margin: 0; font-size: 13px; line-height: 1.6; color: #3d4756; }
        .hod-consent a { color: #0A1628; text-decoration: underline; text-underline-offset: 2px; }
        .hod-consent-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px; }
        .hod-consent-btn { height: 44px; border: 1px solid #0A1628; background: #fff; color: #0A1628; font: 600 11px/1 var(--font-family-montserrat), system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; }
        .hod-consent-btn-solid { background: #0A1628; color: #fff; }
        .hod-consent-btn:focus-visible, .hod-consent-link:focus-visible { outline: 2px solid #B8922A; outline-offset: 2px; }
        .hod-consent-link { grid-column: 1 / -1; height: 36px; border: 0; background: none; color: #0A1628; font: 600 12px/1 var(--font-family-montserrat), system-ui, sans-serif; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
        .hod-consent-row { display: flex; gap: 14px; align-items: flex-start; justify-content: space-between; padding: 14px 0; border-top: 1px solid rgba(10,22,40,.1); }
        .hod-consent-row strong { display: block; font-size: 13px; margin-bottom: 4px; }
        .hod-consent-row small { display: block; margin-top: 6px; font-size: 11px; color: #6A6A6A; line-height: 1.5; }
        .hod-consent-switch { position: relative; flex: none; width: 44px; height: 24px; margin-top: 2px; }
        .hod-consent-switch input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
        .hod-consent-switch input:disabled { cursor: not-allowed; }
        .hod-consent-switch span { position: absolute; inset: 0; border-radius: 12px; background: #c4c9d1; transition: background .2s; pointer-events: none; }
        .hod-consent-switch span::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .2s; }
        .hod-consent-switch input:checked + span { background: #0A1628; }
        .hod-consent-switch input:checked + span::after { transform: translateX(20px); }
        .hod-consent-switch input:disabled + span { opacity: .6; }
        .hod-consent-switch input:focus-visible + span { outline: 2px solid #B8922A; outline-offset: 2px; }
      `}</style>

      <h2 id="hod-consent-title">Your privacy choices</h2>
      <p id="hod-consent-text">
        We use essential cookies to run the store (your cart, currency and sign-in). With your permission we also use analytics and marketing cookies. You can change your choice at any time from Cookie Settings in the footer. Read our <Link href="/privacy-policy">Privacy Policy</Link> and <Link href="/terms">Terms &amp; Conditions</Link>.
      </p>

      {customize ? (
        <div style={{ marginTop: 14 }}>
          <div className="hod-consent-row">
            <div>
              <strong>Essential</strong>
              <p>Needed for the site to work: shopping cart, wishlist, currency, secure sign-in and checkout. Always on.</p>
            </div>
            <label className="hod-consent-switch">
              <input type="checkbox" checked disabled aria-label="Essential cookies, always on" readOnly />
              <span />
            </label>
          </div>
          {OPTIONS.map((option) => (
            <div className="hod-consent-row" key={option.key}>
              <div>
                <strong>{option.title}</strong>
                <p>{option.body}</p>
                <small>Used by: {option.cookies}</small>
              </div>
              <label className="hod-consent-switch">
                <input
                  type="checkbox"
                  checked={values[option.key]}
                  aria-label={`${option.title} cookies`}
                  onChange={(event) => setDraft({ ...values, [option.key]: event.target.checked })}
                />
                <span />
              </label>
            </div>
          ))}
          <div className="hod-consent-actions">
            <button type="button" className="hod-consent-btn" onClick={() => decide(CONSENT_REJECTED)}>Reject non-essential</button>
            <button type="button" className="hod-consent-btn hod-consent-btn-solid" onClick={() => decide(values)}>Save preferences</button>
          </div>
        </div>
      ) : (
        <div className="hod-consent-actions">
          <button type="button" className="hod-consent-btn" onClick={() => decide(CONSENT_REJECTED)}>Reject non-essential</button>
          <button type="button" className="hod-consent-btn hod-consent-btn-solid" onClick={() => decide(CONSENT_ACCEPTED)}>Accept all</button>
          <button type="button" className="hod-consent-link" onClick={() => setCustomize(true)}>Customize</button>
        </div>
      )}
    </div>
  )
}
