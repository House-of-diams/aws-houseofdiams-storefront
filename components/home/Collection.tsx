'use client';

import { useRouter } from 'next/navigation';
import { cinzelFont } from '@/app/fonts';
import type { HomeCollectionItem } from '@/lib/home-data';
import { resolveLegacyHipHopHref } from '@/lib/legacy-hiphop';
import { mediaUrl } from '@/lib/media-url';

interface CollectionProps {
  onEnquire?: (name: string) => void;
  items?: HomeCollectionItem[];
}

interface PanelData {
  index: number;
  name: string;
  label: string;
  desc: string;
  cta: string;
  ctaHref: string;
  imageSrc?: string | null;
  bgClass: string;
}

interface CollectionApiItem {
  sort_order: number;
  label: string;
  title: string;
  description: string;
  image_path: string;
  link: string;
}

const PANELS: PanelData[] = [
  {
    index: 0,
    name: 'Fine Jewellery',
    label: 'Collection 01',
    desc: 'Necklaces, earrings, bracelets & pendants',
    cta: 'Shop Now',
    ctaHref: '/fine-jewellery',
    bgClass: 'bg-[linear-gradient(145deg,#F5F7FC,#D8E2F2)]',
  },
  {
    index: 1,
    name: 'Engagement Rings',
    label: 'Collection 02',
    desc: 'Solitaire, halo, pave & three stone',
    cta: 'Shop Now',
    ctaHref: '/engagement-rings',
    bgClass: 'bg-[linear-gradient(145deg,#EEF3FA,#D2DEEF)]',
  },
  {
    index: 2,
    name: 'Wedding Bands',
    label: 'Collection 03',
    desc: 'For her & for him, classic to diamond-set',
    cta: 'Shop Now',
    ctaHref: '/wedding-bands',
    bgClass: 'bg-[linear-gradient(145deg,#FAFBFD,#E2E9F5)]',
  },
  {
    index: 3,
    name: 'Hip Hop',
    label: 'Collection 04',
    desc: 'Iced chains, grillz & statement pieces',
    cta: 'Shop Now',
    ctaHref: '/shop',
    bgClass: 'bg-[linear-gradient(145deg,#F2F5FA,#D6E0F0)]',
  },
];

function mapPanels(items: CollectionApiItem[]): PanelData[] {
  return items.map((item, index) => ({
    index,
    name: item.title,
    label: item.label || `Collection ${String(index + 1).padStart(2, '0')}`,
    desc: item.description,
    cta: 'Shop Now',
    ctaHref: resolveLegacyHipHopHref(item.link),
    imageSrc: item.image_path ? mediaUrl(item.image_path) : null,
    bgClass: index % 2 === 0 ? 'bg-[linear-gradient(145deg,#F5F7FC,#D8E2F2)]' : 'bg-[linear-gradient(145deg,#EEF3FA,#D2DEEF)]',
  }));
}

export default function Collection({ items = [] }: CollectionProps) {
  const router = useRouter();
  const panels = items.length ? mapPanels(items) : PANELS;

  return (
    <section className="mx-auto w-full max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
      <div className="mb-[var(--space-section-block)] text-center">
        <h2 className={`${cinzelFont.variable} font-primary-display section-title font-light leading-[1.08] tracking-[0.01em] text-[#0A1628] max-md:text-[28px]`} style={{ fontSize: 'clamp(24px, 4.5vw, 54px)', fontWeight: 400 }}>
          Our <em className="not-italic italic">Collections</em>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[12px] font-light tracking-[0.1em] text-[#292727] sm:text-[13px]">
          Discover the signature worlds of House of Diams through a refined card-based selection.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {panels.map((panel, index) => (
          <article
            key={`${panel.name}-${index}`}
            className="group overflow-hidden rounded-none border border-white/30 bg-white shadow-[0_18px_48px_rgba(10,22,40,0.08)] transition duration-500 hover:-translate-y-1 hover:shadow-[0_24px_56px_rgba(10,22,40,0.14)]"
          >
            <button
              type="button"
              onClick={() => router.push(panel.ctaHref)}
              className="block w-full text-left"
            >
              <div className={`relative aspect-[4/5] overflow-hidden ${panel.bgClass}`}>
                {panel.imageSrc ? (
                  <img
                    src={panel.imageSrc}
                    alt={panel.name}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                    loading={index < 2 ? 'eager' : 'lazy'}
                  />
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#FAFBFD_0%,#EAF0FA_42%,#D8E2F2_100%)]" />
                )}

                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,22,40,0.06)_0%,rgba(10,22,40,0.18)_48%,rgba(10,22,40,0.76)_100%)]" />

                <div className="absolute inset-x-0 bottom-0 z-[1] p-3 sm:p-5">
                  <h3 className="font-serif text-[16px] font-normal leading-[1.05] text-white min-[420px]:text-[19px] sm:text-[28px]">
                    {panel.name}
                  </h3>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 font-[family-name:var(--font-family-button)] text-[7px] font-medium uppercase tracking-[0.16em] text-white/92 sm:mt-2 sm:gap-2.5 sm:text-[10px]">
                    <span>{panel.cta}</span>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M4 3L9 7L4 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </div>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
