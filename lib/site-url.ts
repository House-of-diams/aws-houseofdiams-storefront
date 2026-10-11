const DEFAULT_SITE_URL = 'https://houseofdiams.com'

export function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    DEFAULT_SITE_URL

  const normalizedUrl = configuredUrl.startsWith('http')
    ? configuredUrl
    : `https://${configuredUrl}`

  return normalizedUrl.replace(/\/+$/, '')
}

export function getCanonicalUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return new URL(normalizedPath, getSiteUrl())
}
