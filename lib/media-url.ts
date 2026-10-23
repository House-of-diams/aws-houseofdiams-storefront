const cdnBase = process.env.NEXT_PUBLIC_MEDIA_CDN_BASE_URL?.trim().replace(/\/+$/, '') ?? ''

function encodeKey(key: string) {
  return key.split('/').map((segment) => {
    try { return encodeURIComponent(decodeURIComponent(segment)) }
    catch { return encodeURIComponent(segment) }
  }).join('/')
}

function storageKey(value: string): string {
  return value.replace(/^\/+/, '')
}

/** Resolve stored media keys to the AWS media CDN; absolute URLs (the CDN itself or external images) are kept as they are. */
export function mediaUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  const input = value.trim()
  if (input.startsWith('/_next/') || input.startsWith('/images/') || input.startsWith('/video/')) return input

  if (/^https?:\/\//i.test(input)) {
    try { new URL(input) } catch { return '' }
    return input
  }
  if (input.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(input)) return ''

  const key = storageKey(input)
  if (!key) return ''
  return cdnBase ? `${cdnBase}/${encodeKey(key)}` : input
}
