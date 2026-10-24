'use client'

import { useSyncExternalStore } from 'react'
import { buildConsentCookie, isAnalyticsCookieName, readConsentFromCookieString, type ConsentChoice, type StoredConsent } from '@/lib/consent'

const CHANGE_EVENT = 'hod:consent-change'
const OPEN_EVENT = 'hod:consent-open'

let cachedRaw: string | undefined
let cachedValue: StoredConsent | null = null

function snapshot(): StoredConsent | null {
  const raw = document.cookie
  if (raw !== cachedRaw) {
    cachedRaw = raw
    const next = readConsentFromCookieString(raw)
    const same = next && cachedValue && next.analytics === cachedValue.analytics && next.marketing === cachedValue.marketing && next.ts === cachedValue.ts
    if (!same) cachedValue = next
  }
  return cachedValue
}

function subscribe(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener)
  return () => window.removeEventListener(CHANGE_EVENT, listener)
}

/** `undefined` while the page is still hydrating, `null` when the visitor has not decided yet. */
export function useConsent(): StoredConsent | null | undefined {
  return useSyncExternalStore(subscribe, snapshot, () => undefined)
}

function clearAnalyticsCookies() {
  const hosts = [undefined, location.hostname, `.${location.hostname.split('.').slice(-2).join('.')}`]
  for (const entry of document.cookie.split(';')) {
    const name = entry.split('=')[0]?.trim()
    if (!name || !isAnalyticsCookieName(name)) continue
    for (const domain of hosts) document.cookie = `${name}=; Path=/; Max-Age=0${domain ? `; Domain=${domain}` : ''}`
  }
}

export function saveConsent(choice: ConsentChoice) {
  const previous = snapshot()
  document.cookie = buildConsentCookie(choice, location.protocol === 'https:')
  if (previous?.analytics && !choice.analytics) {
    window.gtag?.('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
    clearAnalyticsCookies()
  } else if (previous?.marketing && !choice.marketing) {
    window.gtag?.('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function openConsentSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function subscribeToConsentOpen(listener: () => void) {
  window.addEventListener(OPEN_EVENT, listener)
  return () => window.removeEventListener(OPEN_EVENT, listener)
}
