'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import { preload } from 'react-dom';
import { mediaUrl } from '@/lib/media-url';
import BrandButton from '@/components/ui/BrandButton';

type HeroSlide = {
  sort_order: number;
  image_path: string;
  mobile_image_path?: string;
  headline: string;
  subtitle: string;
  button_text: string;
  button_link: string;
};

type HeroContent = {
  eyebrow: string;
  headline: string;
  subtitle: string;
  slider_enabled?: boolean;
  slider_items?: HeroSlide[];
};

interface HeroProps {
  onEnquireClick?: () => void;
  initialContent?: HeroContent;
  onPrimaryVisualReady?: () => void;
}

const defaultContent: HeroContent = {
  eyebrow: 'Surat, India · Est. 2014 · Fine Jewellery',
  headline: 'Crafted in Light.',
  subtitle:
    'Certified lab-grown diamonds, precious gemstones and bespoke fine jewellery — handcrafted in the diamond capital of the world.',
  slider_enabled: false,
  slider_items: [],
};

const getPublicImageUrl = (path: string) => {
  if (!path) return '';
  return mediaUrl(path);
};

export default function Hero({ initialContent, onPrimaryVisualReady }: HeroProps) {
  const [content, setContent] = useState<HeroContent>(() => ({
    ...defaultContent,
    ...initialContent,
    slider_items: initialContent?.slider_items ?? [],
  }));
  const [activeSlide, setActiveSlide] = useState(0);
  const [contentResolved, setContentResolved] = useState(Boolean(initialContent));
  const hasSignaledPrimaryVisualRef = useRef(false);
  const heroRef = useRef<HTMLElement>(null);
  const isHeroVisibleRef = useRef(false);
  const hasInteractedRef = useRef(false);
  const pointerStartXRef = useRef<number | null>(null);
  const pointerMovedRef = useRef(false);

  const signalPrimaryVisualReady = () => {
    if (hasSignaledPrimaryVisualRef.current) return;
    hasSignaledPrimaryVisualRef.current = true;
    onPrimaryVisualReady?.();
  };

  useEffect(() => {
    if (initialContent) return;

    const loadHero = async () => {
      const response = await fetch('/api/public/home-hero')
      const payload = await response.json().catch(() => null)
      const heroData = payload?.content

      if (!heroData) {
        setContentResolved(true);
        return;
      }

      const sliderItems: HeroSlide[] = heroData.slider_items ?? []

      setContent({
        eyebrow: heroData.eyebrow,
        headline: heroData.headline,
        subtitle: heroData.subtitle,
        slider_enabled: heroData.slider_enabled,
        slider_items: sliderItems,
      });
      setContentResolved(true);
    };

    loadHero().catch(() => {
      setContentResolved(true);
      signalPrimaryVisualReady();
    });
  }, [initialContent]);

  const slides = useMemo(
    () =>
      (content.slider_items ?? [])
        .filter((item) => item.image_path.trim().length > 0)
        .sort((a, b) => a.sort_order - b.sort_order),
    [content.slider_items]
  );

  useEffect(() => {
    if (!content.slider_enabled || slides.length <= 1) return;

    const hero = heroRef.current;
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => {
      isHeroVisibleRef.current = entry.isIntersecting;
    }, { rootMargin: '160px 0px', threshold: 0.01 });
    observer.observe(hero);

    const intervalId = window.setInterval(() => {
      if (!isHeroVisibleRef.current || hasInteractedRef.current) return;
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 4500);

    return () => {
      observer.disconnect();
      window.clearInterval(intervalId);
    };
  }, [content.slider_enabled, slides]);

  const handleHeroPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    hasInteractedRef.current = true;
    pointerStartXRef.current = event.clientX;
    pointerMovedRef.current = false;
  };

  const handleHeroPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (pointerStartXRef.current === null) return;
    if (Math.abs(event.clientX - pointerStartXRef.current) > 12) pointerMovedRef.current = true;
  };

  const handleHeroPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (pointerStartXRef.current !== null && pointerMovedRef.current && slides.length > 1) {
      const distance = event.clientX - pointerStartXRef.current;
      setActiveSlide((current) => distance < 0 ? (current + 1) % slides.length : (current - 1 + slides.length) % slides.length);
    }
    pointerStartXRef.current = null;
    pointerMovedRef.current = false;
  };

  const [line1, ...rest] = content.headline.split(' ');
  const line2 = rest.join(' ');
  const currentSlide = slides[activeSlide] ?? slides[0];
  const hasImageHero = Boolean(content.slider_enabled && currentSlide);
  const primarySlide = slides[0];
  if (primarySlide) {
    const desktopImageUrl = getPublicImageUrl(primarySlide.image_path);
    const mobileImageUrl = getPublicImageUrl(primarySlide.mobile_image_path || primarySlide.image_path);
    const preloadImage = (src: string, media?: string) => {
      const { props } = getImageProps({ src, alt: '', fill: true, sizes: '100vw' });
      preload(String(props.src), {
        as: 'image',
        fetchPriority: 'high',
        imageSrcSet: props.srcSet,
        imageSizes: props.sizes,
        media,
      });
    };

    if (mobileImageUrl === desktopImageUrl) preloadImage(desktopImageUrl);
    else {
      preloadImage(mobileImageUrl, '(max-width: 639px)');
      preloadImage(desktopImageUrl, '(min-width: 640px)');
    }
  }
  useEffect(() => {
    if (!contentResolved) return;
    if (!hasImageHero) {
      signalPrimaryVisualReady();
    }
  }, [contentResolved, hasImageHero]);

  return (
    <section
      ref={heroRef}
      onPointerDown={handleHeroPointerDown}
      onPointerMove={handleHeroPointerMove}
      onPointerUp={handleHeroPointerUp}
      onPointerCancel={handleHeroPointerUp}
      className={[
        'relative flex items-center justify-center overflow-hidden',
        hasImageHero
          ? 'min-h-0 px-0 py-0'
          : 'min-h-[92vh] px-[52px] py-[60px] max-md:min-h-[80vh] max-md:px-5 max-md:py-10',
      ].join(' ')}
      style={{
        background: hasImageHero
          ? 'var(--theme-base)'
          : 'radial-gradient(ellipse 80% 50% at 50% 20%, rgba(10,22,40,0.08), transparent), radial-gradient(ellipse 60% 40% at 10% 80%, rgba(10,22,40,0.05), transparent), var(--theme-base)',
      }}
    >
      {!hasImageHero ? (
        <>
          <div
            className="absolute inset-0 pointer-events-none opacity-35 mix-blend-multiply"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E")`,
            }}
          />

          <div
            className="absolute rounded-full pointer-events-none animate-[orbFloat_12s_ease-in-out_infinite_alternate]"
            style={{
              width: 380,
              height: 380,
              top: -120,
              right: -100,
              background: 'var(--theme-ink)',
              filter: 'blur(60px)',
              opacity: 0.25,
            }}
          />
          <div
            className="absolute rounded-full pointer-events-none animate-[orbFloat_10s_ease-in-out_infinite_alternate]"
            style={{
              width: 300,
              height: 300,
              bottom: -80,
              left: -80,
              background: '#20304a',
              filter: 'blur(60px)',
              opacity: 0.2,
              animationDelay: '2s',
            }}
          />
        </>
      ) : null}

      {content.slider_enabled && currentSlide ? (
        <div className="relative z-[2] w-full">
          <div className="relative overflow-hidden rounded-none border-0 bg-transparent shadow-none backdrop-blur-0">
            <div className="relative h-[520px] sm:hidden">
              {slides.map((slide, index) => {
                const mobileImageUrl = getPublicImageUrl(slide.mobile_image_path || slide.image_path);
                return (
                  <div
                    key={`${slide.sort_order}-${slide.image_path}-mobile`}
                    className={`absolute inset-0 transition-opacity duration-700 ${index === activeSlide ? 'opacity-100' : 'opacity-0'}`}
                  >
                    <Image
                      src={mobileImageUrl}
                      alt={slide.button_text || `Hero slide ${index + 1}`}
                      fill
                      sizes="100vw"
                      className="h-full w-full object-cover"
                      onLoad={() => {
                        if (index === 0) signalPrimaryVisualReady();
                      }}
                      onError={() => {
                        if (index === 0) signalPrimaryVisualReady();
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="relative hidden aspect-[5/2] sm:block">
              {slides.map((slide, index) => {
                const desktopImageUrl = getPublicImageUrl(slide.image_path);
                return (
                  <div
                    key={`${slide.sort_order}-${slide.image_path}-desktop`}
                    className={`absolute inset-0 transition-opacity duration-700 ${index === activeSlide ? 'opacity-100' : 'opacity-0'}`}
                  >
                    <Image
                      src={desktopImageUrl}
                      alt={slide.button_text || `Hero slide ${index + 1}`}
                      fill
                      sizes="100vw"
                      className="h-full w-full object-cover"
                      onLoad={() => {
                        if (index === 0) signalPrimaryVisualReady();
                      }}
                      onError={() => {
                        if (index === 0) signalPrimaryVisualReady();
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {(currentSlide.headline.trim() ||
              currentSlide.subtitle.trim() ||
              (currentSlide.button_text.trim() && currentSlide.button_link.trim())) ? (
              <>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-full bg-gradient-to-t from-black/5 via-black/5 to-transparent" />
                <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-start px-[var(--space-4)] pb-[var(--space-10)] text-left sm:items-end sm:justify-start sm:px-[var(--space-8)] sm:pb-[var(--space-10)] lg:px-[var(--space-12)] xl:px-[var(--space-16)]">
                  <div className="relative mx-auto w-full max-w-[calc(100vw-2rem)] py-[var(--space-6)] sm:mx-0 sm:max-w-[42rem] sm:py-[var(--space-10)]">
                    {currentSlide.headline.trim() ? (
                      <h1
                        className="hero-slide-heading text-[clamp(1.75rem,7vw,2.25rem)] font-medium leading-[1.12] tracking-[-0.02em] text-white sm:text-[clamp(2.25rem,3.4vw,3.25rem)]"
                      >
                        <span className="block whitespace-pre-line break-words">{currentSlide.headline.trim()}</span>
                      </h1>
                    ) : null}

                    {currentSlide.subtitle.trim() ? (
                      <p
                        className="mx-auto mt-[var(--space-2)] max-w-[calc(100vw-2rem)] text-center text-[clamp(0.75rem,2.8vw,0.95rem)] leading-[1.55] text-white/90 sm:mx-0 sm:max-w-[38rem] sm:text-left sm:text-[clamp(0.9rem,1.15vw,1.1rem)]"
                        style={{ fontFamily: 'var(--font-family-secondary)' }}
                      >
                        {currentSlide.subtitle}
                      </p>
                    ) : null}

                    {currentSlide.button_text.trim() && currentSlide.button_link.trim() ? (
                      <div className="pointer-events-auto flex justify-center md:justify-start">
                        <BrandButton
                          href={currentSlide.button_link}
                          className="banner-light-button mt-[var(--space-3)]"
                        >
                          {currentSlide.button_text}
                        </BrandButton>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}

            <div className="absolute inset-x-0 bottom-0 z-30 flex items-end justify-end px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
              <div className="flex min-h-[48px] items-end justify-end">
                {slides.length > 1 ? (
                  <div className="flex items-center gap-2">
                    {slides.map((slide, index) => (
                      <button
                        key={`${slide.sort_order}-dot`}
                        type="button"
                        onClick={() => setActiveSlide(index)}
                        className={`h-2.5 rounded-full transition-all ${index === activeSlide ? 'w-10 bg-white' : 'w-2.5 bg-white/45'}`}
                        aria-label={`Go to slide ${index + 1}`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-[2] max-w-[960px] text-center">
          <h1 className="mb-8 animate-[fadeUp_1.2s_0.4s_ease_forwards] font-serif text-[clamp(40px,9vw,132px)] font-light leading-[0.95] tracking-[-0.01em] text-[var(--theme-heading)] max-md:text-[54px]">
            {line1}
            <br />
            <span className="relative inline-block font-normal text-[var(--theme-ink)]">
              <span className="relative">
                {line2}
                <span
                  className="absolute bottom-[-8px] left-[5%] w-[90%] h-px pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, transparent, var(--theme-ink), transparent)' }}
                />
              </span>
            </span>
          </h1>

          <p className="mx-auto mb-11 max-w-[620px] animate-[fadeUp_1.2s_0.6s_ease_forwards] font-serif text-[13px] font-light leading-[2] tracking-[0.14em] text-[var(--theme-muted)]">
            {content.subtitle}
          </p>

          <div className="flex gap-[18px] justify-center flex-wrap animate-[fadeUp_1.2s_0.8s_ease_forwards] max-md:flex-col max-md:w-full">
            <Link
              href="/shop"
              className="group relative inline-flex cursor-pointer items-center gap-2.5 overflow-hidden border-none bg-[var(--theme-ink)] px-[34px] py-4 font-[family-name:var(--font-family-button)] text-[10px] font-normal uppercase tracking-[0.28em] text-white no-underline transition-all duration-400 max-md:justify-center hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(10,22,40,0.18)]"
            >
              <span className="absolute inset-0 z-0 translate-y-full bg-[#20304a] transition-transform duration-[450ms] ease-[cubic-bezier(0.77,0,0.18,1)] group-hover:translate-y-0" />
              <span className="relative z-10">Explore Collection</span>
            </Link>
            <Link
              href="/bespoke"
              className="inline-flex cursor-pointer items-center justify-center gap-2.5 border border-[var(--theme-ink)] bg-transparent px-8 py-[15px] font-[family-name:var(--font-family-button)] text-[10px] font-normal uppercase tracking-[0.28em] text-[var(--theme-ink)] no-underline transition-all duration-400 hover:bg-[var(--theme-ink)] hover:text-white"
            >
              Commission a Piece
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
