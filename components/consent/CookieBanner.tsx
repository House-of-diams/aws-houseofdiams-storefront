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
        .hod-consent { position: fixed; z-index: 2000; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); box-sizing: border-box; border-radius: 26px; color: #0A1628; font-family: var(--font-family-montserrat), system-ui, sans-serif; outline: none; overflow: hidden;
          background: linear-gradient(145deg, rgba(255,255,255,.84), rgba(255,255,255,.6)); -webkit-backdrop-filter: blur(28px) saturate(180%); backdrop-filter: blur(28px) saturate(180%);
          border: 1px solid rgba(255,255,255,.5);
          box-shadow: 0 28px 64px -16px rgba(10,22,40,.34), 0 2px 10px rgba(10,22,40,.08), inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(10,22,40,.05);
          animation: hod-consent-in .6s cubic-bezier(.22,1,.36,1) both; }
        .hod-consent::before { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1.5px; pointer-events: none; z-index: 1;
          background: linear-gradient(140deg, rgba(255,255,255,1) 0%, rgba(255,255,255,.12) 38%, rgba(255,255,255,.05) 62%, rgba(184,146,42,.5) 100%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
        .hod-consent::after { content: ''; position: absolute; top: -40%; left: -20%; width: 70%; height: 80%; pointer-events: none; border-radius: 50%; background: radial-gradient(closest-side, rgba(255,255,255,.55), rgba(255,255,255,0)); }
        @supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) { .hod-consent { background: rgba(255,255,255,.97); } }
        .hod-consent-scroll { position: relative; z-index: 2; max-height: min(84vh, 620px); overflow-y: auto; overscroll-behavior: contain; padding: 22px 20px 20px; }
        .hod-consent-leaving { animation: hod-consent-out .4s cubic-bezier(.55,0,.8,.2) both; pointer-events: none; }
        @keyframes hod-consent-in { from { transform: translateY(40px) scale(.96); opacity: 0; filter: blur(8px); } to { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); } }
        @keyframes hod-consent-out { from { transform: translateY(0) scale(1); opacity: 1; } to { transform: translateY(40px) scale(.96); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .hod-consent { animation: hod-consent-fade-in .15s linear both; }
          .hod-consent-leaving { animation: hod-consent-fade-out .15s linear both; }
          @keyframes hod-consent-fade-in { from { opacity: 0; } to { opacity: 1; } }
          @keyframes hod-consent-fade-out { from { opacity: 1; } to { opacity: 0; } }
        }
        @media (min-width: 769px) {
          .hod-consent { left: 24px; right: auto; bottom: 24px; width: 440px; }
          .hod-consent-scroll { padding: 26px 26px 24px; }
        }
        .hod-consent h2 { margin: 0 0 8px; font-size: 17px; font-weight: 600; letter-spacing: -.005em; }
        .hod-consent p { margin: 0; font-size: 13.5px; line-height: 1.6; color: #36404f; }
        .hod-consent a { color: #0A1628; text-decoration: underline; text-decoration-color: rgba(10,22,40,.35); text-underline-offset: 3px; }
        .hod-consent-actions { display: flex; flex-direction: column; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
        .hod-consent-btn { display: flex; align-items: center; justify-content: center; box-sizing: border-box; width: 100%; min-height: 50px; padding: 13px 24px; border-radius: 16px; border: 1px solid rgba(10,22,40,.16); background: rgba(255,255,255,.66); color: #0A1628; font: 600 14px/1.25 var(--font-family-montserrat), system-ui, sans-serif; letter-spacing: .005em; text-align: center; white-space: normal; cursor: pointer; transition: transform .18s ease, background .18s ease, box-shadow .18s ease; box-shadow: inset 0 1px 0 rgba(255,255,255,.9); }
        .hod-consent-btn:hover { background: rgba(255,255,255,.92); transform: translateY(-1px); }
        .hod-consent-btn-solid { border-color: rgba(10,22,40,.9); background: linear-gradient(180deg, #16263f, #0A1628); color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.2), 0 10px 22px -10px rgba(10,22,40,.7); }
        .hod-consent-btn-solid:hover { background: linear-gradient(180deg, #1b2e4b, #0d1b31); }
        .hod-consent-btn:focus-visible, .hod-consent-link:focus-visible { outline: 2px solid #B8922A; outline-offset: 2px; }
        .hod-consent-link { align-self: center; min-height: 40px; padding: 8px 16px; border: 0; border-radius: 12px; background: none; color: #0A1628; font: 600 13px/1.2 var(--font-family-montserrat), system-ui, sans-serif; text-decoration: underline; text-decoration-color: rgba(10,22,40,.35); text-underline-offset: 4px; cursor: pointer; }
        @media (min-width: 480px) { .hod-consent-actions { flex-direction: row; } .hod-consent-actions .hod-consent-btn { flex: 1 1 0; } .hod-consent-link { flex-basis: 100%; } }
        .hod-consent-row { display: flex; gap: 14px; align-items: flex-start; justify-content: space-between; padding: 14px 0; border-top: 1px solid rgba(10,22,40,.08); }
        .hod-consent-row strong { display: block; font-size: 13.5px; margin-bottom: 4px; }
        .hod-consent-row small { display: block; margin-top: 6px; font-size: 11.5px; color: #5d6676; line-height: 1.5; }
        .hod-consent-switch { position: relative; flex: none; width: 48px; height: 28px; margin-top: 2px; }
        .hod-consent-switch input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
        .hod-consent-switch input:disabled { cursor: not-allowed; }
        .hod-consent-switch span { position: absolute; inset: 0; border-radius: 999px; background: rgba(10,22,40,.18); box-shadow: inset 0 1px 2px rgba(10,22,40,.12); transition: background .22s; pointer-events: none; }
        .hod-consent-switch span::after { content: ''; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(10,22,40,.3); transition: transform .22s cubic-bezier(.3,1.4,.5,1); }
        .hod-consent-switch input:checked + span { background: #0A1628; }
        .hod-consent-switch input:checked + span::after { transform: translateX(20px); }
        .hod-consent-switch input:disabled + span { opacity: .55; }
        .hod-consent-switch input:focus-visible + span { outline: 2px solid #B8922A; outline-offset: 2px; }
      `}</style>

      <div className="hod-consent-scroll">
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
    </div>
  )
}
