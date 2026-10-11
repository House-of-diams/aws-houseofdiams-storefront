'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { mediaUrl } from '@/lib/media-url';

function RevealDiv({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          entries[0].target.classList.add('opacity-100', 'translate-y-0');
          entries[0].target.classList.remove('opacity-0', 'translate-y-6');
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -50px' }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
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

interface BespokeHeroProps {
  onEnquireClick?: () => void;
  initialHero?: HeroContent | null;
  initialSlides?: HeroSlide[];
  initialCategories?: PortfolioCategory[];
}

type HeroContent = {
  badge_text?: string | null;
  eyebrow?: string | null;
  heading_line_1?: string | null;
  heading_line_2?: string | null;
  subtitle?: string | null;
  primary_cta_label?: string | null;
  secondary_cta_label?: string | null;
  secondary_cta_action?: string | null;
  slider_enabled?: boolean | null;
};

type HeroSlide = {
  sort_order: number;
  image_path: string;
  mobile_image_path?: string;
  button_text: string;
  button_link: string;
};

type PortfolioCategory = {
  id: string;
  name: string;
  slug: string;
  image_path?: string | null;
};

type RailCard = {
  id: string;
  imagePath?: string;
  mobileImagePath?: string | null;
  label: string;
  filterKey?: string;
  href?: string;
};

const fallbackHero: Required<HeroContent> = {
  badge_text: 'Est. 2014 · Surat, India',
  eyebrow: 'Bespoke Atelier',
  heading_line_1: 'Your Vision.',
  heading_line_2: 'Our Craft.',
  subtitle:
    "Every piece at House of Diams is conceived and created to order with certified lab-grown diamonds. Share your idea and we'll bring it to life from our Surat workshops to your hands.",
  primary_cta_label: 'Start Your Commission',
  secondary_cta_label: 'Configure Your Piece',
  secondary_cta_action: '#bespoke-form',
  slider_enabled: false,
};

export default function BespokeHero({ onEnquireClick, initialHero = null, initialSlides = [], initialCategories = [] }: BespokeHeroProps) {
  const [hero, setHero] = useState<Required<HeroContent> & { slider_enabled: boolean }>({
    badge_text: initialHero?.badge_text ?? fallbackHero.badge_text,
    eyebrow: initialHero?.eyebrow ?? fallbackHero.eyebrow,
    heading_line_1: initialHero?.heading_line_1 ?? fallbackHero.heading_line_1,
    heading_line_2: initialHero?.heading_line_2 ?? fallbackHero.heading_line_2,
    subtitle: initialHero?.subtitle ?? fallbackHero.subtitle,
    primary_cta_label: initialHero?.primary_cta_label ?? fallbackHero.primary_cta_label,
    secondary_cta_label: initialHero?.secondary_cta_label ?? fallbackHero.secondary_cta_label,
    secondary_cta_action: initialHero?.secondary_cta_action ?? fallbackHero.secondary_cta_action,
    slider_enabled: Boolean(initialHero?.slider_enabled ?? false),
  });
  const [slides, setSlides] = useState<HeroSlide[]>(initialSlides);
  const [categories, setCategories] = useState<PortfolioCategory[]>(initialCategories);
  const railRef = useRef<HTMLDivElement>(null);
  const secondaryHref = hero.secondary_cta_action || '#bespoke-form';

  const getPublicImageUrl = (path: string) => {
    if (!path) return '';
    return mediaUrl(path);
  };

  useEffect(() => {
    if (initialHero) return;
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/public/bespoke/hero');
        const payload = await response.json();
        if (!active || !payload?.item) return;
        setHero({
          badge_text: payload.item.badge_text ?? fallbackHero.badge_text,
          eyebrow: payload.item.eyebrow ?? fallbackHero.eyebrow,
          heading_line_1: payload.item.heading_line_1 ?? fallbackHero.heading_line_1,
          heading_line_2: payload.item.heading_line_2 ?? fallbackHero.heading_line_2,
          subtitle: payload.item.subtitle ?? fallbackHero.subtitle,
          primary_cta_label: payload.item.primary_cta_label ?? fallbackHero.primary_cta_label,
          secondary_cta_label: payload.item.secondary_cta_label ?? fallbackHero.secondary_cta_label,
          secondary_cta_action: payload.item.secondary_cta_action ?? fallbackHero.secondary_cta_action,
          slider_enabled: Boolean(payload.item.slider_enabled),
        });
        setSlides(payload.items ?? []);
      } catch {
        if (active) setHero({ ...fallbackHero, slider_enabled: false });
      }
    })();
    return () => {
      active = false;
    };
  }, [initialHero]);

  useEffect(() => {
    if (initialCategories.length) return;
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/public/bespoke/portfolio');
        const payload = await response.json();
        if (active) setCategories(Array.isArray(payload?.categories) ? payload.categories : []);
      } catch {
        if (active) setCategories([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [initialCategories]);

  const sortedSlides = useMemo(
    () => slides.filter((item) => item.image_path?.trim()).sort((a, b) => a.sort_order - b.sort_order),
    [slides]
  );

  const categoryCards = useMemo<RailCard[]>(
    () => categories
      .map((category) => ({
        id: category.id,
        imagePath: category.image_path?.trim() || undefined,
        label: category.name,
        filterKey: category.slug,
        href: '#bespoke-portfolio',
      })),
    [categories]
  );

  // Bespoke now deliberately shares the collection-page shell. The CMS slide
  // setting remains intact, but slides are rendered as collection options
  // instead of a standalone full-width campaign banner.
  const hasImageHero = true;
  const primaryCtaLabel = hero.primary_cta_label || 'Start Your Commission';
  const heroCards: RailCard[] = sortedSlides.length ? sortedSlides.map((slide) => ({
    id: `${slide.sort_order}-${slide.image_path}`,
    imagePath: slide.image_path,
    mobileImagePath: slide.mobile_image_path,
    label: slide.button_text || primaryCtaLabel,
    href: slide.button_link,
  })) : [{
    id: 'bespoke-fallback',
    imagePath: '',
    mobileImagePath: '',
    label: primaryCtaLabel,
  }];
  const railCards = categoryCards.length ? categoryCards : heroCards;
  const scrollRail = (direction: number) => {
    railRef.current?.scrollBy({ left: direction * Math.max(railRef.current.clientWidth * 0.65, 280), behavior: 'smooth' });
  };

  return (
    <section
      className={hasImageHero ? 'border-b border-black/10 bg-white pb-7 pt-[var(--space-7)] sm:pb-9 sm:pt-[var(--space-8)] lg:pt-[calc(146px+var(--space-8))]' : 'pt-[100px] pb-[80px] px-[52px] text-center relative max-lg:px-7 max-md:px-5 max-md:pt-[70px] max-md:pb-[60px]'}
      style={{ background: '#ffffff' }}
    >
      {hasImageHero ? (
        <>
          <div className="px-4 sm:px-7 lg:px-[52px]">
            <div>
              <nav aria-label="Breadcrumb" className="my-3 flex items-center gap-3 text-[12px] font-normal tracking-[0.01em] text-gray-700">
                <Link href="/" className="text-gray-700 no-underline hover:text-gray-900">Home</Link><span aria-hidden="true" className="text-gray-700">/</span><span className="text-gray-700">Bespoke</span>
              </nav>
              <h1 className="section-title text-left text-[clamp(1.35rem,2.2vw,2rem)] font-medium uppercase leading-none tracking-[0.025em] text-[var(--color-brand-primary,#000)]">
                Explore Bespoke Collection
              </h1>
            </div>
          </div>
          <div className="relative mt-6 px-1.5 sm:px-5 lg:px-[60px]">
            <div ref={railRef} className="flex snap-x snap-mandatory gap-2 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Bespoke collection inspiration">
              {railCards.map((slide, index) => {
                const image = slide.imagePath ? getPublicImageUrl(slide.imagePath) : '';
                const mobileImage = slide.mobileImagePath ? getPublicImageUrl(slide.mobileImagePath) : image;
                const initials = slide.label.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
                const card = <>{image ? <picture><source media="(max-width: 640px)" srcSet={mobileImage} /><Image src={image} alt={slide.label || `Bespoke inspiration ${index + 1}`} fill priority={index === 0} sizes={index === 0 ? '(max-width: 640px) 36vw, 516px' : '(max-width: 640px) 36vw, 256px'} className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.025]" /></picture> : <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-100 via-neutral-200 to-neutral-300"><span className="font-[family-name:var(--font-family-primary)] text-3xl font-medium tracking-[0.18em] text-black/35">{initials || 'B'}</span></span>}<span className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" /><span className="absolute inset-x-0 bottom-0 flex min-h-[52px] items-end p-4 text-left font-[family-name:var(--font-family-primary)] text-[12px] font-medium uppercase leading-[1.3] tracking-[0.07em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]"><span className="shop-hero-label-underline">{slide.label}</span></span></>;
                const className = `group relative aspect-[2/3] h-auto w-[36vw] min-w-[140px] max-w-[256px] shrink-0 snap-start overflow-hidden bg-[#F2F1EE] text-white no-underline sm:h-[320px] sm:aspect-auto ${index === 0 ? 'lg:w-[516px] lg:max-w-none' : 'sm:w-[256px]'}`;
                if (slide.filterKey) {
                  return <button key={slide.id} type="button" onClick={() => { window.dispatchEvent(new CustomEvent('bespoke-filter', { detail: slide.filterKey })); }} className={`${className} cursor-pointer border-0 p-0 text-left`}>{card}</button>;
                }
                return slide.href?.trim() ? <Link key={slide.id} href={slide.href} className={className}>{card}</Link> : <button key={slide.id} type="button" onClick={onEnquireClick} className={`${className} border-0 p-0 text-left cursor-pointer`}>{card}</button>;
              })}
            </div>
            {railCards.length > 1 ? <><button type="button" aria-label="Scroll bespoke inspiration backward" onClick={() => scrollRail(-1)} className="absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-black/15 bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.14)] sm:flex">←</button><button type="button" aria-label="Scroll bespoke inspiration forward" onClick={() => scrollRail(1)} className="absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-black/15 bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.14)] sm:flex">→</button></> : null}
          </div>
        </>
      ) : (
        <>
          <RevealDiv className="flex justify-center">
            <div className="inline-flex items-center gap-2.5 px-[18px] py-[7px] text-[10px] font-normal tracking-[0.3em] text-[#0A1628] bg-[#F5F7FC] border border-[rgba(10,22,40,0.25)] uppercase mb-6 before:content-[''] before:w-[5px] before:h-[5px] before:bg-[#0A1628] before:rounded-full">
              {hero.badge_text}
            </div>
          </RevealDiv>

          <RevealDiv delay={50} className="flex justify-center">
            <div className="text-[10px] font-normal tracking-[0.32em] text-[#0A1628] uppercase mb-[18px] inline-flex items-center gap-3 before:content-[''] before:w-6 before:h-px before:bg-[#0A1628]">
              {hero.eyebrow}
            </div>
          </RevealDiv>

          <RevealDiv delay={100}>
            <h1
              className="font-serif font-light leading-[1] tracking-[-0.01em] text-[#0A1628] mt-6 mb-7 mx-auto max-w-[900px]"
              style={{ fontSize: 'clamp(56px, 7vw, 108px)' }}
            >
              {hero.heading_line_1}
              <br />
              <em className="not-italic text-[#0A1628] font-normal">{hero.heading_line_2}</em>
            </h1>
          </RevealDiv>

          <RevealDiv delay={200}>
            <p className="text-[13px] font-light leading-[2] text-[#292727] tracking-[0.06em] max-w-[640px] mx-auto mb-10">
              {hero.subtitle}
            </p>
          </RevealDiv>

          <RevealDiv delay={300}>
            <div className="flex gap-[18px] justify-center flex-wrap max-md:flex-col max-md:w-full max-md:items-stretch">
              <button
                onClick={onEnquireClick}
                className="inline-flex items-center justify-center gap-2.5 text-[10px] font-normal tracking-[0.28em] text-[#FAFBFD] bg-[#0A1628] px-[34px] py-4 border-none cursor-pointer uppercase relative overflow-hidden group transition-all duration-400 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(10,22,40,0.18)]"
              >
                <span
                  className="absolute inset-0 bg-[#0A1628] z-0 translate-y-full group-hover:translate-y-0 transition-transform duration-[450ms] ease-[cubic-bezier(0.77,0,0.18,1)]"
                />
                <span className="relative z-10">{hero.primary_cta_label}</span>
              </button>
              <Link
                href={secondaryHref}
                className="inline-flex items-center justify-center gap-2.5 text-[10px] font-normal tracking-[0.28em] text-[#0A1628] bg-transparent px-8 py-[15px] border border-[#0A1628] cursor-pointer uppercase no-underline transition-all duration-400 hover:bg-[#0A1628] hover:text-[#FAFBFD]"
              >
                {hero.secondary_cta_label}
              </Link>
            </div>
          </RevealDiv>
        </>
      )}
    </section>
  );
}
