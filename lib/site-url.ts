const DEFAULT_SITE_URL = 'https://houseofdiams.com'

/** A host such as uat.houseofdiams.com: a test copy of the site that must never be named as the public address. */
function isTestEnvironmentHost(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().startsWith('uat.')
  } catch {
    return false
  }
}

export function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    DEFAULT_SITE_URL

  const normalizedUrl = /^https?:\/\//i.test(configuredUrl)
    ? configuredUrl
    : `https://${configuredUrl}`

  // The public address drives canonical tags, the sitemap and structured data. A live (production) build must
  // never publish a test host there, whatever the server setting says, or search engines are told to index the wrong site.
  if (process.env.NODE_ENV === 'production' && isTestEnvironmentHost(normalizedUrl)) return DEFAULT_SITE_URL

  return normalizedUrl.replace(/\/+$/, '')
}

/**
 * The address used in links inside emails. Same safety as getSiteUrl() when a site address is configured;
 * with none configured (local development) emails point at the local server, as before.
 */
export function getEmailSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL ? getSiteUrl() : 'http://localhost:3000'
}

export function getCanonicalUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return new URL(normalizedPath, getSiteUrl())
}
