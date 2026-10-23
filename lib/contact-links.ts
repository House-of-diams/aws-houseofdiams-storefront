const SAFE_CONTACT_HREF = /^(https?:\/\/|mailto:|tel:|\/(?![\/\\]))/i

export function getSafeContactHref(value: string | null | undefined) {
  const href = value?.trim()
  return href && SAFE_CONTACT_HREF.test(href) ? href : null
}
