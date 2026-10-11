import { legacyMediaOrigins } from '@/lib/legacy-media-origins'

const cdnBase = process.env.NEXT_PUBLIC_MEDIA_CDN_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
const bucket = 'hod'

function encodeKey(key: string) {
  return key.split('/').map((segment) => {
    try { return encodeURIComponent(decodeURIComponent(segment)) }
    catch { return encodeURIComponent(segment) }
  }).join('/')
}

function storageKey(value: string): string | null {
  const path = value.replace(/^\/+/, '')
  const publicMatch = path.match(/^storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
  if (publicMatch) return publicMatch[1] === bucket ? publicMatch[2] : null
  return path
}

/** Resolve owned, public media to the verified CDN while preserving external URLs. */
export function mediaUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  const input = value.trim()
  if (input.startsWith('/_next/') || input.startsWith('/images/') || input.startsWith('/video/')) return input

  let key: string | null
  const absolute = /^https?:\/\//i.test(input)
  if (absolute) {
    let parsed: URL
    try { parsed = new URL(input) } catch { return '' }
    const host = parsed.hostname.toLowerCase()
    const cdnHost = cdnBase ? new URL(cdnBase).hostname.toLowerCase() : ''
    if (host === cdnHost) return input
    const origin = legacyMediaOrigins.find((entry) => entry.host === host)
    if (origin?.type === 'public-storage') {
      const match = parsed.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
      if (!match || match[1] !== bucket) return ''
      key = match[2]
    } else if (origin?.type === 'object-storage' || host.endsWith('.r2.dev')) {
      key = parsed.pathname.replace(/^\/+/, '')
    } else return input
  } else if (input.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(input)) return ''
  else key = storageKey(input)

  if (!key) return ''
  // Incomplete CDN configuration must never send owned media back to an old provider.
  if (!cdnBase && absolute) return ''
  if (cdnBase) return `${cdnBase}/${encodeKey(key)}`
  return input
}
