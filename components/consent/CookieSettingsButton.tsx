'use client'

import { openConsentSettings } from '@/lib/consent-client'

export default function CookieSettingsButton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <button type="button" onClick={openConsentSettings} className={`${className ?? ''} cursor-pointer border-0 bg-transparent p-0 text-left`} style={style}>
      Cookie Settings
    </button>
  )
}
