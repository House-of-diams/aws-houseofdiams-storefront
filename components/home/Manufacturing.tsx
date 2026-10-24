'use client';
import { mediaUrl } from '@/lib/media-url';

import { useEffect, useRef, useState } from 'react';

interface Step {
  num: string;
  title: string;
  body: string;
  alt?: boolean;
  icon: React.ReactNode;
  sparks?: { top: string; left?: string; right?: string; delay?: string }[];
}

interface CmsManufacturingItem {
  id?: number;
  sort_order: number;
  step: string;
  eyebrow: string;
  title: string;
  description: string;
  media_type?: 'image' | 'video';
  media_path?: string;
  media_url?: string;
  image_path: string;
  image_url?: string;
}

type ManufacturingEntry =
  | (Step & { kind: 'fallback'; key: string })
  | (CmsManufacturingItem & { kind: 'cms'; key: string; alt: boolean });

const steps: Step[] = [
  {
    num: 'Step 01',
    title: 'Stone Selection',
    body: 'Every lab-grown diamond is hand-picked for color, clarity and cut consistency. We review over 100 stones to approve one for a solitaire, ten for a tennis bracelet.',
    icon: (
      <svg className="w-[55%] max-w-[220px] relative z-10 filter drop-shadow-[0_8px_20px_rgba(10,22,40,0.15)] transition-transform duration-[600ms] group-hover:scale-105" viewBox="0 0 80 80" fill="none">
        <polygon points="40,12 60,22 60,50 40,60 20,50 20,22" stroke="#0A1628" strokeWidth="1" fill="rgba(10,22,40,0.08)" />
        <polygon points="40,20 52,26 52,46 40,52 28,46 28,26" stroke="#0A1628" strokeWidth="0.6" fill="none" opacity=".5" />
        <line x1="40" y1="12" x2="40" y2="60" stroke="#0A1628" strokeWidth="0.4" opacity=".4" />
        <line x1="20" y1="22" x2="60" y2="50" stroke="#0A1628" strokeWidth="0.4" opacity=".3" />
        <line x1="60" y1="22" x2="20" y2="50" stroke="#0A1628" strokeWidth="0.4" opacity=".3" />
        <circle cx="40" cy="68" r="2" fill="#0A1628" opacity=".6" />
        <circle cx="40" cy="73" r="1.2" fill="#0A1628" opacity=".4" />
      </svg>
    ),
    sparks: [{ top: '22%', left: '30%' }, { top: '60%', right: '25%', delay: '1s' }],
  },
  {
    num: 'Step 02',
    title: 'CAD Design',
    body: 'Your vision rendered digitally. Every prong, every pavé seat, every curve modelled in 3D CAD to millimetre precision. Approved on screen before a single piece of metal is cut.',
    alt: true,
    icon: (
      <svg className="w-[55%] max-w-[220px] relative z-10 filter drop-shadow-[0_8px_20px_rgba(10,22,40,0.15)] transition-transform duration-[600ms] group-hover:scale-105" viewBox="0 0 80 80" fill="none">
        <rect x="12" y="18" width="56" height="36" rx="2" stroke="#0A1628" strokeWidth="1" fill="rgba(10,22,40,0.05)" />
        <rect x="12" y="18" width="56" height="6" fill="rgba(10,22,40,0.15)" />
        <circle cx="18" cy="21" r="1" fill="#0A1628" />
        <circle cx="22" cy="21" r="1" fill="#0A1628" opacity=".6" />
        <circle cx="26" cy="21" r="1" fill="#0A1628" opacity=".4" />
        <circle cx="40" cy="38" r="10" stroke="#0A1628" strokeWidth="0.8" fill="none" />
        <circle cx="40" cy="28" r="3" stroke="#0A1628" strokeWidth="0.6" fill="rgba(10,22,40,0.2)" />
        <line x1="40" y1="28" x2="30" y2="38" stroke="#0A1628" strokeWidth="0.3" opacity=".5" />
        <line x1="40" y1="28" x2="50" y2="38" stroke="#0A1628" strokeWidth="0.3" opacity=".5" />
        <line x1="30" y1="38" x2="50" y2="38" stroke="#0A1628" strokeWidth="0.3" opacity=".5" />
        <rect x="34" y="58" width="12" height="2" fill="#0A1628" opacity=".4" />
        <rect x="28" y="60" width="24" height="3" fill="#0A1628" opacity=".3" />
      </svg>
    ),
    sparks: [{ top: '30%', left: '70%' }],
  },
  {
    num: 'Step 03',
    title: 'Casting the Metal',
    body: '18K gold, platinum or 925 silver — melted at 1,064°C and poured into the wax mould. Cooled, broken out and filed down by hand into the raw skeleton of your piece.',
    icon: (
      <svg className="w-[55%] max-w-[220px] relative z-10 filter drop-shadow-[0_8px_20px_rgba(10,22,40,0.15)] transition-transform duration-[600ms] group-hover:scale-105" viewBox="0 0 80 80" fill="none">
        <ellipse cx="40" cy="42" rx="20" ry="6" stroke="#0A1628" strokeWidth="0.8" fill="rgba(10,22,40,0.08)" />
        <ellipse cx="40" cy="40" rx="20" ry="6" stroke="#0A1628" strokeWidth="0.8" fill="rgba(10,22,40,0.12)" />
        <path d="M20 40 L20 50" stroke="#0A1628" strokeWidth="0.8" />
        <path d="M60 40 L60 50" stroke="#0A1628" strokeWidth="0.8" />
        <path d="M40 14 Q37 18 37 22 Q37 26 40 26 Q43 26 43 22 Q43 18 40 14Z" stroke="#20304A" strokeWidth="0.8" fill="rgba(32,48,74,0.3)" />
        <line x1="40" y1="26" x2="40" y2="32" stroke="#20304A" strokeWidth="1" opacity=".5" />
        <circle cx="40" cy="34" r="1.5" fill="#20304A" />
      </svg>
    ),
    sparks: [{ top: '20%', left: '50%', delay: '.5s' }],
  },
  {
    num: 'Step 04',
    title: 'Setting the Stones',
    body: 'Under 10x magnification, our master setters place each diamond by hand — bending prongs, channelling baguettes, checking every girdle. Hours per stone. Zero compromise.',
    alt: true,
    icon: (
      <svg className="w-[55%] max-w-[220px] relative z-10 filter drop-shadow-[0_8px_20px_rgba(10,22,40,0.15)] transition-transform duration-[600ms] group-hover:scale-105" viewBox="0 0 80 80" fill="none">
        <circle cx="30" cy="30" r="12" stroke="#0A1628" strokeWidth="1" fill="rgba(10,22,40,0.08)" />
        <circle cx="30" cy="30" r="8" stroke="#0A1628" strokeWidth="0.5" fill="none" />
        <line x1="40" y1="38" x2="50" y2="50" stroke="#0A1628" strokeWidth="1.4" />
        <polygon points="30,25 33,28 32,34 28,34 27,28" fill="rgba(32,48,74,0.4)" stroke="#0A1628" strokeWidth="0.4" />
        <line x1="15" y1="10" x2="26" y2="24" stroke="#0A1628" strokeWidth="0.6" />
        <line x1="18" y1="10" x2="29" y2="24" stroke="#0A1628" strokeWidth="0.6" />
        <circle cx="55" cy="58" r="10" stroke="#0A1628" strokeWidth="1" fill="rgba(10,22,40,0.05)" />
        <circle cx="55" cy="48" r="2.5" fill="rgba(32,48,74,0.5)" stroke="#0A1628" strokeWidth="0.5" />
      </svg>
    ),
    sparks: [{ top: '35%', left: '35%' }, { top: '75%', right: '30%', delay: '1.2s' }],
  },
  {
    num: 'Step 05',
    title: 'Polish & Quality Check',
    body: 'Rhodium dipped where needed. Polished on a rouge wheel to mirror finish. Inspected under 20x loupe for the final sign-off. Every certificate matched. Every piece signed for before it leaves Surat.',
    icon: (
      <svg className="w-[55%] max-w-[220px] relative z-10 filter drop-shadow-[0_8px_20px_rgba(10,22,40,0.15)] transition-transform duration-[600ms] group-hover:scale-105" viewBox="0 0 80 80" fill="none">
        <circle cx="40" cy="40" r="18" stroke="#0A1628" strokeWidth="1" fill="rgba(10,22,40,0.05)" />
        <circle cx="40" cy="40" r="14" stroke="#0A1628" strokeWidth="0.5" fill="none" opacity=".5" />
        <circle cx="40" cy="40" r="10" stroke="#0A1628" strokeWidth="0.4" fill="none" opacity=".4" />
        <circle cx="40" cy="40" r="2" fill="#0A1628" />
        <line x1="40" y1="12" x2="40" y2="18" stroke="#20304A" strokeWidth="0.8" opacity=".6" />
        <line x1="40" y1="62" x2="40" y2="68" stroke="#20304A" strokeWidth="0.8" opacity=".6" />
        <line x1="12" y1="40" x2="18" y2="40" stroke="#20304A" strokeWidth="0.8" opacity=".6" />
        <line x1="62" y1="40" x2="68" y2="40" stroke="#20304A" strokeWidth="0.8" opacity=".6" />
        <line x1="20" y1="20" x2="24" y2="24" stroke="#20304A" strokeWidth="0.6" opacity=".5" />
        <line x1="56" y1="56" x2="60" y2="60" stroke="#20304A" strokeWidth="0.6" opacity=".5" />
        <line x1="56" y1="24" x2="60" y2="20" stroke="#20304A" strokeWidth="0.6" opacity=".5" />
        <line x1="20" y1="60" x2="24" y2="56" stroke="#20304A" strokeWidth="0.6" opacity=".5" />
      </svg>
    ),
    sparks: [{ top: '15%', left: '45%', delay: '.3s' }, { top: '55%', left: '70%', delay: '.8s' }, { top: '70%', left: '20%', delay: '1.5s' }],
  },
];

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('opacity-100', 'translate-y-0');
            e.target.classList.remove('opacity-0', 'translate-y-6');
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -50px' }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function RevealDiv({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useReveal();
  return (
    <div
      ref={ref}
      className={`opacity-0 translate-y-6 transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.2,0.7,0.3,1)] ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function resolvePublicMediaUrl(path?: string) {
  if (!path) return '';
  return mediaUrl(path);
}

function LazyManufacturingVideo({ src, poster, title }: { src: string; poster?: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: '300px 0px', threshold: 0.01 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={shouldLoad ? src : undefined}
      poster={poster || undefined}
      aria-label={title}
      className="absolute inset-0 h-full w-full object-cover"
      autoPlay={shouldLoad}
      muted
      loop
      playsInline
      preload="none"
    />
  );
}

export default function Manufacturing({ initialItems = [] }: { initialItems?: CmsManufacturingItem[] }) {
  const [items, setItems] = useState<CmsManufacturingItem[]>(initialItems);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (initialItems.length) return;
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/public/bespoke/manufacturing');
        const payload = await response.json();
        if (!active) return;
        setItems(Array.isArray(payload?.items) ? payload.items : []);
      } catch {
        if (active) setItems([]);
      }
    })();
    return () => { active = false; };
  }, [initialItems]);

  const hasCmsItems = items.length > 0;
  const entries: ManufacturingEntry[] = hasCmsItems
    ? items.map((item) => ({
        ...item,
        kind: 'cms' as const,
        key: `cms-${item.id ?? item.sort_order}`,
        alt: Number(item.sort_order) % 2 === 0,
      }))
    : steps.map((step) => ({
        ...step,
        kind: 'fallback' as const,
        key: `fallback-${step.num}`,
      }));

  const activeEntry = entries[activeIndex] ?? entries[0];
  const goToPrevStep = () => setActiveIndex((current) => (current - 1 + entries.length) % entries.length);
  const goToNextStep = () => setActiveIndex((current) => (current + 1) % entries.length);

  useEffect(() => {
    if (entries.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % entries.length);
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [entries.length]);

  return (
    <section className="relative overflow-hidden bg-white pb-[120px] max-lg:pb-[80px]">
      {/* Workshop carousel - full-bleed banners with hero-style overlaid text */}
      {entries.length ? (
        <div className="relative w-full">
          <div className="relative h-[520px] sm:aspect-[5/2] sm:h-auto">
            {entries.map((entry, index) => (
              <div
                key={entry.key}
                aria-hidden={index !== activeIndex}
                className={`absolute inset-0 transition-opacity duration-700 ${index === activeIndex ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'radial-gradient(circle at 30% 40%, rgba(10,22,40,0.08), transparent 60%), radial-gradient(circle at 70% 70%, rgba(32,48,74,0.05), transparent 50%), linear-gradient(135deg, #FAFBFD 0%, #F5F7FC 100%)',
                  }}
                />
                {entry.kind === 'cms' ? (
                  entry.media_type === 'video' && (entry.media_path || entry.image_path) ? (
                    <LazyManufacturingVideo
                      src={entry.media_url || resolvePublicMediaUrl(entry.media_path || entry.image_path)}
                      poster={entry.image_url || resolvePublicMediaUrl(entry.image_path)}
                      title={entry.title}
                    />
                  ) : (
                    <img
                      src={entry.image_url || entry.media_url || resolvePublicMediaUrl(entry.media_path || entry.image_path)}
                      alt={entry.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {entry.icon}
                    {entry.sparks?.map((spark, si) => (
                      <div
                        key={si}
                        className="absolute w-1 h-1 bg-[#0A1628] rounded-full shadow-[0_0_8px_#20304A] z-[2] animate-[sparkDot_3s_ease-in-out_infinite]"
                        style={{ top: spark.top, left: spark.left, right: spark.right, animationDelay: spark.delay || '0s' }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2/3 bg-gradient-to-t from-black/70 via-black/28 to-transparent" />

            {activeEntry ? (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-end px-[var(--space-4)] pb-[var(--space-10)] text-left sm:px-[var(--space-8)] lg:px-[var(--space-12)]">
                <div className="w-full max-w-[42rem]">
                  <h3 className="hero-slide-heading text-[clamp(1.75rem,7vw,2.25rem)] font-medium leading-[1.12] tracking-[-0.02em] text-white sm:text-[clamp(2.25rem,3.4vw,3.25rem)]">
                    {activeEntry.title}
                  </h3>
                  <p
                    className="mt-[var(--space-2)] max-w-[38rem] text-[clamp(0.75rem,2.8vw,0.95rem)] leading-[1.55] text-white/90 sm:text-[clamp(0.9rem,1.15vw,1.1rem)]"
                    style={{ fontFamily: 'var(--font-family-secondary)' }}
                  >
                    {activeEntry.kind === 'cms' ? activeEntry.description : activeEntry.body}
                  </p>
                </div>
              </div>
            ) : null}

            {entries.length > 1 ? (
              <>
                <div className="absolute inset-x-0 bottom-4 z-30 flex items-center justify-end gap-2 px-4 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:justify-between sm:px-6 lg:px-8">
                  <button
                    type="button"
                    onClick={goToPrevStep}
                    aria-label="Previous step"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/22 bg-white/12 text-white backdrop-blur-xl transition hover:bg-white/18 hover:border-white/34"
                    style={{ boxShadow: '0 14px 38px rgba(10,22,40,0.18)' }}
                  >
                    <span className="text-lg leading-none">&#8592;</span>
                  </button>
                  <button
                    type="button"
                    onClick={goToNextStep}
                    aria-label="Next step"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/22 bg-white/12 text-white backdrop-blur-xl transition hover:bg-white/18 hover:border-white/34"
                    style={{ boxShadow: '0 14px 38px rgba(10,22,40,0.18)' }}
                  >
                    <span className="text-lg leading-none">&#8594;</span>
                  </button>
                </div>
                <div className="absolute inset-x-0 bottom-0 z-30 flex items-end px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
                  <div className="flex min-h-[48px] items-end">
                    <div className="flex items-center gap-2">
                      {entries.map((entry, index) => (
                        <button
                          key={`${entry.key}-dot`}
                          type="button"
                          onClick={() => setActiveIndex(index)}
                          className={`h-2.5 rounded-full transition-all ${index === activeIndex ? 'w-10 bg-white' : 'w-2.5 bg-white/45'}`}
                          aria-label={`Go to step ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

