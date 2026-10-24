import 'server-only'

import { findActiveHomeOfferFromRds } from '@/lib/repositories/public-cms-repository'
import { resolveHomeOffer, type HomeOffer, type HomeOfferRow } from '@/lib/home-offer'
import { mediaUrl } from '@/lib/media-url'
import { isF7ReadPreviewEnabled } from '@/lib/f7-read-preview'
import { cachePublicRead, PUBLIC_CACHE_SHORT_SECONDS } from '@/lib/public-cache'

async function readActiveHomeOffer(): Promise<HomeOffer | null> {
  const row = await findActiveHomeOfferFromRds() as HomeOfferRow
  return resolveHomeOffer(row, new Date(), mediaUrl, !isF7ReadPreviewEnabled())
}

/** Shared by the home page and the offers page, so both always agree on which offer is live. */
export const getCachedActiveHomeOffer = cachePublicRead('home-offer', readActiveHomeOffer, PUBLIC_CACHE_SHORT_SECONDS)
