'use client';

import type { CollectionPageConfig } from '@/lib/home-data';
import { FindYourMatchQuiz } from '@/components/home/FindYourMatchQuiz';

export default function CollectionShowcase({ config }: { config: CollectionPageConfig }) {
  const desktopImage = config.showcaseImageUrl || config.showcaseMobileImageUrl || '';
  const mobileImage = config.showcaseMobileImageUrl || desktopImage;

  return (
    <section className="relative mt-[var(--space-section-block)] w-full overflow-hidden bg-black" aria-labelledby="collection-showcase-heading">
      <picture className="block aspect-[4/5] w-full sm:aspect-[6336/2688]">
        {mobileImage ? <source media="(max-width: 639px)" srcSet={mobileImage} /> : null}
        {desktopImage ? <img src={desktopImage} alt={config.showcaseHeading || 'Collection showcase'} className="block size-full object-cover object-center" loading="lazy" /> : <span className="block size-full bg-black" />}
      </picture>
      <div className="absolute inset-0 z-10 flex items-end justify-center px-[var(--space-4)] pb-[var(--space-10)] text-center md:justify-start md:text-left md:px-[var(--space-8)] md:pb-[var(--space-10)] lg:px-[var(--space-12)] xl:px-[var(--space-16)]">
        <div className="w-full max-w-[42rem] py-[var(--space-6)] md:py-[var(--space-10)]">
          <h2 id="collection-showcase-heading" className="hero-slide-heading text-[clamp(1.75rem,7vw,2.25rem)] font-medium leading-[1.12] tracking-[-0.02em] text-white sm:text-[clamp(2.25rem,3.4vw,3.25rem)]">
            {config.showcaseHeading || 'Collection'}
          </h2>
          <p className="mx-auto mt-[var(--space-2)] max-w-[38rem] font-[family-name:var(--font-family-secondary)] text-[clamp(0.75rem,2.8vw,0.95rem)] leading-[1.55] text-white/90 md:mx-0 md:text-[clamp(0.9rem,1.15vw,1.1rem)]">
            {config.showcaseSubtitle || 'Browse House of Diams collection pieces in a dedicated enquiry-first showcase.'}
          </p>
          <div className="pointer-events-auto flex justify-center md:block">
            <FindYourMatchQuiz />
          </div>
        </div>
      </div>
    </section>
  );
}
