'use client';

import Image from 'next/image';

import BrandButton from '@/components/ui/BrandButton';
import type { HomeBespokeShowcaseSection } from '@/lib/home-data';

const VIDEO_FILE_PATTERN = /\.(?:mp4|webm|ogg|mov)(?:$|[?#])/i;

export default function BespokeShowcase({
  section,
  onEnquireClick,
}: {
  section: HomeBespokeShowcaseSection;
  onEnquireClick: () => void;
}) {
  const mediaUrl = section.imageUrl || section.mobileImageUrl || '';
  const isVideo = VIDEO_FILE_PATTERN.test(mediaUrl);
  const mobileMediaUrl = section.mobileImageUrl || mediaUrl;
  const isMobileVideo = VIDEO_FILE_PATTERN.test(mobileMediaUrl);

  const renderMedia = (src: string, video: boolean) =>
    video ? (
      <video
        className="absolute inset-0 h-full w-full object-cover object-center"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={section.imageAlt || section.heading || 'House of Diams bespoke jewellery showcase'}
      >
        <source src={src} />
      </video>
    ) : (
      <Image
        src={src}
        alt={section.imageAlt || section.heading || 'House of Diams bespoke jewellery showcase'}
        fill
        sizes="100vw"
        className="h-full w-full object-cover object-center"
      />
    );

  return (
    <section className="relative flex min-h-0 items-center justify-center overflow-hidden bg-[var(--color-brand-accent,#fff)] px-0 py-0">
      <div className="relative z-[2] w-full">
        <div className="relative overflow-hidden rounded-none border-0 bg-[var(--color-brand-primary,#000)] shadow-none backdrop-blur-0">
          <div className="relative aspect-[4/5] sm:hidden">
            {mobileMediaUrl ? renderMedia(mobileMediaUrl, isMobileVideo) : null}
          </div>
          <div className="relative hidden aspect-[6336/2688] sm:block">
            {mediaUrl ? renderMedia(mediaUrl, isVideo) : null}
          </div>


          <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-start px-[var(--space-4)] pb-[var(--space-10)] text-left sm:items-end sm:justify-start sm:px-[var(--space-8)] sm:pb-[var(--space-10)] lg:px-[var(--space-12)] xl:px-[var(--space-16)]">
            <div className="relative mx-auto w-full max-w-[calc(100vw-2rem)] py-[var(--space-6)] text-[var(--color-brand-accent,#fff)] sm:mx-0 sm:max-w-[42rem] sm:py-[var(--space-10)]">
              <h2
                className="text-center text-[clamp(1.75rem,7vw,2.25rem)] font-medium leading-[1.12] tracking-[-0.02em] text-white sm:text-left sm:text-[clamp(2.25rem,3.4vw,3.25rem)]"
              >
                <span className="block whitespace-pre-line break-words">
                  {(section.heading || 'Create Something One of One').trim()}
                </span>
              </h2>

              <p
                className="mx-auto mt-[var(--space-2)] max-w-[calc(100vw-2rem)] text-center text-[clamp(0.75rem,2.8vw,0.95rem)] leading-[1.55] text-white/90 sm:mx-0 sm:max-w-[38rem] sm:text-left sm:text-[clamp(0.9rem,1.15vw,1.1rem)]"
                style={{ fontFamily: 'var(--font-family-secondary)' }}
              >
                {section.subtitle || 'Begin a bespoke commission with House of Diams, from first sketch to final setting.'}
              </p>

              <div className="pointer-events-auto flex justify-center md:justify-start">
                <BrandButton onClick={onEnquireClick} className="banner-light-button mt-[var(--space-3)]">
                  {section.ctaLabel || 'Start Bespoke Enquiry'}
                </BrandButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
