'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cinzelFont } from '@/app/fonts';
import type { HomeCoupleItem } from '@/lib/home-data';
import { mediaUrl } from '@/lib/media-url';

type CoupleItem = {
  names: string;
  location: string;
  story: string;
  product_name: string;
  product_link?: string;
  product_detail: string;
  image_path: string;
};

function buildImageUrl(path: string) {
  return mediaUrl(path);
}

function StarRating() {
  return (
    <div className="flex gap-0.75 mb-3.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="w-3 h-3 bg-[#0A1628]"
          style={{
            clipPath:
              'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
          }}
        />
      ))}
    </div>
  );
}

function HeartIcon() {
  return (
    <svg className="opacity-[0.12]" width="80" height="80" viewBox="0 0 80 80" fill="none">
      <path d="M40 70L10 40C3 33 3 21 10 14C17 7 29 7 40 17C51 7 63 7 70 14C77 21 77 33 70 40L40 70Z" stroke="#0A1628" strokeWidth="1.5" fill="rgba(10,22,40,0.05)" />
    </svg>
  );
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      {direction === 'left' ? (
        <path d="M15 6L9 12L15 18" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M9 6L15 12L9 18" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function ProductNameLink({ name, href }: { name: string; href?: string }) {
  if (!href) {
    return <div className="font-serif text-[16px] text-[#0A1628]">{name}</div>;
  }

  return (
    <Link
      href={href}
      className="font-serif text-[16px] text-[#0A1628] underline underline-offset-4 transition-opacity hover:opacity-70"
      onClick={(event) => event.stopPropagation()}
    >
      {name}
    </Link>
  );
}

export default function CouplesSection({
  initialData,
}: {
  initialData?: { eyebrow: string; heading: string; subtitle: string; items: HomeCoupleItem[] }
}) {
  const [heading] = useState(initialData?.heading || 'Our Cute Couples');
  const [subtitle] = useState(initialData?.subtitle || 'Real couples. Real proposals. Real diamonds. Every ring tells a story.');
  const [items] = useState<CoupleItem[]>(initialData?.items ?? []);
  const [active, setActive] = useState<CoupleItem | null>(null);
  const [cardsPerView, setCardsPerView] = useState(3);
  const [activePage, setActivePage] = useState(0);

  useEffect(() => {
    if (!active) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const lenis = typeof window !== 'undefined' ? (window as any).__lenis : null;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (lenis && typeof lenis.stop === 'function') {
      lenis.stop();
    }

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      if (lenis && typeof lenis.start === 'function') {
        lenis.start();
      }
    };
  }, [active]);

  useEffect(() => {
    const syncCardsPerView = () => {
      if (window.innerWidth < 768) {
        setCardsPerView(1);
        return;
      }
      if (window.innerWidth < 1100) {
        setCardsPerView(2);
        return;
      }
      setCardsPerView(3);
    };

    syncCardsPerView();
    window.addEventListener('resize', syncCardsPerView);
    return () => window.removeEventListener('resize', syncCardsPerView);
  }, []);

  const pages = useMemo(() => {
    if (items.length === 0) return [] as CoupleItem[][];
    return Array.from({ length: Math.ceil(items.length / cardsPerView) }, (_, pageIndex) =>
      items.slice(pageIndex * cardsPerView, pageIndex * cardsPerView + cardsPerView)
    );
  }, [cardsPerView, items]);

  useEffect(() => {
    if (pages.length === 0) return;
    setActivePage((current) => Math.min(current, pages.length - 1));
  }, [pages.length]);

  const modal = useMemo(() => {
    if (typeof document === 'undefined' || !active) return null;
    return createPortal(
      <div
        className="fixed inset-0 z-[1400] flex items-center justify-center overflow-y-auto bg-[rgba(10,22,40,0.34)] px-4 py-6 backdrop-blur-[14px] sm:px-5 sm:py-8"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        onClick={() => setActive(null)}
      >
        <div
          className="relative mx-auto flex max-h-[78vh] w-full max-w-[440px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl md:max-h-[88vh] md:max-w-3xl md:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setActive(null)}
            className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/92 text-[#0A1628] shadow-[0_10px_25px_rgba(10,22,40,0.16)] transition hover:bg-white"
            aria-label="Close popup"
          >
            <X size={16} />
          </button>
          <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-2">
            <div className="min-h-[180px] shrink-0 bg-[#F5F7FC] flex items-center justify-center md:min-h-[320px]">
              {active.image_path ? <img src={buildImageUrl(active.image_path)} alt={active.names} className="h-full w-full object-cover" /> : <HeartIcon />}
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pr-3 touch-pan-y md:max-h-none md:overflow-visible md:p-8"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div className="mb-3 pr-8 text-[9px] uppercase tracking-[0.24em] text-[#0A1628] md:text-[10px] md:tracking-[0.3em]">{active.location}</div>
              <h3 className="mb-3 font-serif text-[26px] leading-none text-[#0A1628] md:mb-4 md:text-3xl">{active.names}</h3>
              <StarRating />
              <p className="mb-4 text-[12px] leading-6 text-[#555] md:mb-6 md:text-sm md:leading-8">{active.story}</p>
              <div className="border border-black/8 bg-[#fafafa] px-4 py-4">
                <ProductNameLink name={active.product_name} href={active.product_link} />
                <div className="text-[9px] uppercase tracking-[0.2em] text-[#999] mt-1">{active.product_detail}</div>
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }, [active]);

  const showCarouselControls = pages.length > 1;

  return (
    <section className="relative overflow-hidden px-13 py-[var(--space-section-block)] max-md:px-5" style={{ background: 'linear-gradient(180deg,#F5F7FC,#fff)' }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(10,22,40,0.3),transparent)' }} />
      <div className="max-w-350 mx-auto">
        <div className="mb-[var(--space-section-block)] text-center">
          <h2 className={`${cinzelFont.variable} font-primary-display section-title font-light text-[#0A1628] leading-[1.08] tracking-[0.01em] mb-3.5 max-md:text-[28px]`} style={{ fontSize: 'clamp(24px, 4.5vw, 54px)', fontWeight: 400 }}>
            {heading}
          </h2>
          <p className="text-[12px] font-light tracking-[0.12em] text-[#777] leading-[1.9] max-w-140 mx-auto">
            {subtitle}
          </p>
        </div>

        <div>
          <div className="overflow-hidden rounded-[28px]">
            <div
              className="flex transition-transform duration-700 ease-[cubic-bezier(0.2,0.7,0.3,1)]"
              style={{ transform: `translateX(-${activePage * 100}%)` }}
            >
              {pages.map((pageItems, pageIndex) => (
                <div key={`couples-page-${pageIndex}`} className="min-w-full">
                  <div className={`grid gap-8 ${cardsPerView === 1 ? 'grid-cols-1' : cardsPerView === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {pageItems.map((couple) => (
                      <button
                        key={`${couple.names}-${pageIndex}`}
                        onClick={() => setActive(couple)}
                        className="group relative overflow-hidden border border-black/8 bg-white text-left"
                      >
                        <div className={`relative overflow-hidden bg-gradient-to-br from-[#F5F7FC] to-[#E5ECF7] ${cardsPerView === 1 ? 'h-[310px] sm:h-[340px]' : 'h-80'}`}>
                          {couple.image_path ? (
                            <img
                              src={buildImageUrl(couple.image_path)}
                              alt={couple.names}
                              className="h-full w-full object-cover object-center"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <HeartIcon />
                            </div>
                          )}
                          <div
                            className="pointer-events-none absolute bottom-0 left-0 right-0 h-1/2"
                            style={{ background: 'linear-gradient(transparent,rgba(0,0,0,0.03))' }}
                          />
                        </div>

                        <div className={`${cardsPerView === 1 ? 'relative px-6 pb-7 pt-6' : 'relative px-7 pt-7.5 pb-8.5'}`}>
                          <div
                            className={`${cardsPerView === 1 ? 'absolute right-5 top-5 text-[48px]' : 'absolute top-6 right-6 text-[56px]'} font-serif font-medium leading-[0.5] text-[#0A1628] opacity-20`}
                            aria-hidden="true"
                          >
                            &ldquo;
                          </div>
                          <div className={`${cardsPerView === 1 ? 'mb-1.5 text-[26px]' : 'mb-1.5 text-2xl'} font-serif font-normal tracking-[0.02em] text-[#0A1628]`}>
                            {couple.names}
                          </div>
                          <div className="mb-4 inline-flex items-center gap-2 text-[9px] font-normal uppercase tracking-[0.28em] text-[#0A1628]">
                            <span className="h-1 w-1 rounded-full bg-[#0A1628]" />
                            {couple.location}
                          </div>
                          <StarRating />
                          <p className="mb-5 line-clamp-4 text-[13px] font-light leading-[1.9] tracking-[0.02em] text-[#777]">{couple.story}</p>
                          <div className="flex items-center gap-3.5 border border-black/8 bg-[#F5F7FC] px-4.5 py-4">
                            <div>
                              <ProductNameLink name={couple.product_name} href={couple.product_link} />
                              <div className="mt-0.5 text-[9px] font-normal uppercase tracking-[0.2em] text-[#aaa]">{couple.product_detail}</div>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {showCarouselControls ? (
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setActivePage((current) => Math.max(0, current - 1))}
                disabled={activePage === 0}
                aria-label="Previous couples"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(10,22,40,0.12)] bg-white text-[#0A1628] disabled:opacity-35"
              >
                <Chevron direction="left" />
              </button>
              <button
                type="button"
                onClick={() => setActivePage((current) => Math.min(pages.length - 1, current + 1))}
                disabled={activePage >= pages.length - 1}
                aria-label="Next couples"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(10,22,40,0.12)] bg-white text-[#0A1628] disabled:opacity-35"
              >
                <Chevron direction="right" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {modal}
    </section>
  );
}
