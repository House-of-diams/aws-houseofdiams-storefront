import 'server-only'

import { loadContactInfoFromRds } from '@/lib/repositories/support-repository'
import { cachePublicRead } from '@/lib/public-cache'

// Contact details for the footer's first paint (same data as /api/public/contact/info).
const readContactInfo = cachePublicRead('contact-info', () => loadContactInfoFromRds(), 300)

export function loadPublicContactInfo() {
  return readContactInfo()
}
