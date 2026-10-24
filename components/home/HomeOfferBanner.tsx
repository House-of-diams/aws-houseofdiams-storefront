import Link from 'next/link'
import { OFFERS_PAGE_PATH, type HomeOffer } from '@/lib/home-offer'

/** The active offer on the home page: one image and one button, both opening the Promo Codes & Offers page. */
export default function HomeOfferBanner({ offer }: { offer: HomeOffer | null }) {
  if (!offer) return null
  return (
    <section aria-label="Current offer" className="bg-white px-5 py-[var(--space-section-block)] sm:px-8 lg:px-[52px]">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-5">
        <Link href={OFFERS_PAGE_PATH} className="block w-full" aria-label={offer.home.alt || offer.buttonLabel}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={offer.home.url} alt={offer.home.alt} className="block h-auto w-full" loading="lazy" decoding="async" />
        </Link>
        <Link
          href={OFFERS_PAGE_PATH}
          className="inline-flex min-h-12 items-center justify-center border border-black bg-black px-8 font-[family-name:var(--font-family-button)] text-[11px] font-semibold uppercase tracking-[0.14em] text-white no-underline transition-colors hover:bg-white hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        >
          {offer.buttonLabel}
        </Link>
      </div>
    </section>
  )
}
