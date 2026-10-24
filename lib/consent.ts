// Cookie consent model. Pure functions only, so the rules can be tested without a browser.
// Essential cookies need no consent; analytics and marketing stay off until the visitor opts in.

export const CONSENT_COOKIE = 'hod_consent'
export const CONSENT_VERSION = 1
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180

export type ConsentChoice = { analytics: boolean; marketing: boolean }
export type StoredConsent = ConsentChoice & { v: number; ts: number }

export const CONSENT_REJECTED: ConsentChoice = { analytics: false, marketing: false }
export const CONSENT_ACCEPTED: ConsentChoice = { analytics: true, marketing: true }

export function serializeConsent(choice: ConsentChoice, now = Date.now()): string {
  const stored: StoredConsent = { v: CONSENT_VERSION, analytics: choice.analytics === true, marketing: choice.marketing === true, ts: now }
  return encodeURIComponent(JSON.stringify(stored))
}

// Anything unreadable, from an older policy version, or with the wrong shape counts as "no decision yet".
export function parseConsent(raw: string | null | undefined): StoredConsent | null {
  if (!raw) return null
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<StoredConsent> | null
    if (!value || typeof value !== 'object') return null
    if (value.v !== CONSENT_VERSION) return null
    if (typeof value.analytics !== 'boolean' || typeof value.marketing !== 'boolean' || typeof value.ts !== 'number') return null
    return { v: value.v, analytics: value.analytics, marketing: value.marketing, ts: value.ts }
  } catch {
    return null
  }
}

export function readConsentFromCookieString(cookieString: string): StoredConsent | null {
  for (const part of cookieString.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    if (part.slice(0, index).trim() === CONSENT_COOKIE) return parseConsent(part.slice(index + 1).trim())
  }
  return null
}

export function buildConsentCookie(choice: ConsentChoice, secure: boolean, now = Date.now()): string {
  return `${CONSENT_COOKIE}=${serializeConsent(choice, now)}; Path=/; Max-Age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure ? '; Secure' : ''}`
}

// Cookies set by Google tags that must be removed when analytics consent is withdrawn.
export function isAnalyticsCookieName(name: string): boolean {
  return name === '_ga' || name === '_gid' || name === '_gat' || name.startsWith('_ga_') || name.startsWith('_gat_') || name.startsWith('_gcl_')
}
