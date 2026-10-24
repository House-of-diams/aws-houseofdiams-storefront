import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import OfferAction from '@/components/home/OfferAction'
import ShopByCategory from '@/components/home/ShopByCategory'
import { getCachedActiveHomeOffer } from '@/lib/home-offer-data'
import { OFFERS_PAGE_PATH } from '@/lib/home-offer'
import { createPageMetadata } from '@/lib/seo'
import { getCachedShopByCategory } from '@/lib/shop-by-category'

export function generateMetadata(): Metadata {
  return createPageMetadata({
    title: 'Promo Codes & Offers',
    description: 'The current House of Diams offer and how to use it.',
    path: OFFERS_PAGE_PATH,
  })
}

export default async function PromoCodesAndOffersPage() {
  const [offer, shopByCategory] = await Promise.all([
    getCachedActiveHomeOffer().catch(() => null),
    getCachedShopByCategory().catch(() => null),
  ])
  // With no active offer there is nothing to show, so the page does not exist.
  if (!offer) notFound()

  return (
    <main className="min-h-screen bg-(--color-white) pb-16 pt-10 sm:pb-24 sm:pt-14">
      <h1 className="px-4 text-center font-[family-name:var(--font-family-primary)] text-[clamp(2rem,4vw,3.25rem)] font-normal leading-tight text-[#111111]">
        Promo Codes &amp; Offers
      </h1>

      <section aria-label={offer.left.alt || offer.right.alt || 'Current offer'} className="mx-auto mt-10 w-full max-w-[1600px] px-4 sm:px-8 lg:px-[52px]">
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={offer.left.url} alt={offer.left.alt} className="block h-full w-full object-cover" decoding="async" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={offer.right.url} alt={offer.right.alt} className="block h-full w-full object-cover" decoding="async" />
        </div>
        {offer.action ? <div className="mt-6 flex justify-center"><OfferAction action={offer.action} /></div> : null}
      </section>

      <div className="mt-12 sm:mt-16">
        <ShopByCategory data={shopByCategory} />
      </div>
    </main>
  )
}
