'use client'

import GoogleAnalytics from '@/components/analytics/GoogleAnalytics'
import GoogleTagManager from '@/components/analytics/GoogleTagManager'
import { useConsent } from '@/lib/consent-client'

/** Google tags are loaded only after the visitor has agreed to analytics cookies. */
export default function ConsentedAnalytics() {
  const consent = useConsent()
  if (!consent?.analytics) return null
  return (
    <>
      <GoogleTagManager marketing={consent.marketing} />
      <GoogleAnalytics marketing={consent.marketing} />
    </>
  )
}
