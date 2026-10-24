const SITE_HOSTS = new Set(['houseofdiams.com', 'www.houseofdiams.com', 'uat.houseofdiams.com'])

/**
 * Editors paste full addresses into the CMS, sometimes from the test copy of the site. A link to any copy of this
 * site is turned into a plain path, so it always works on the site the visitor is on and never leaks a test host.
 * Everything else (other sites, mailto:, tel:, paths, anything unrecognised) is returned unchanged.
 */
export function toSiteLink(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!/^https?:\/\//i.test(trimmed)) return value
  try {
    const url = new URL(trimmed)
    if (!SITE_HOSTS.has(url.hostname.toLowerCase())) return value
    return `${url.pathname}${url.search}${url.hash}` || '/'
  } catch {
    return value
  }
}
