'use client';

import Link from 'next/link';
import { startTransition, useEffect, useMemo, useOptimistic, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * @typedef {{ id: string; title: string; iconUrl?: string | null; href?: string | null; options: { label: string; href: string; type?: 'default' | 'swatch' | 'icon', iconUrl?: string | null, colorHex?: string | null }[], emphasis?: 'section' | 'group' }} ShopHeroBrowseSection
 */

/**
 * @param {{
 *   title?: string
 *   heading?: string
 *   subtitle?: string
 *   desktopImageUrl?: string
 *   mobileImageUrl?: string
 *   imageAlt?: string
 *   ctaLabel?: string
 *   ctaHref?: string
 *   bannerEnabled?: boolean
 *   browseSections?: ShopHeroBrowseSection[]
 *   activeFilters?: Record<string, string[]>
 *   onBrowseNavigate?: (href: string) => boolean
 *   wideGutter?: boolean
 * }} props
 */
export default function ShopHero({
  title = 'Our Collection',
  heading = '',
  desktopImageUrl = '',
  mobileImageUrl = '',
  imageAlt = '',
  ctaHref = '',
  browseSections = [],
  activeFilters = {},
  onBrowseNavigate,
  wideGutter = false,
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const collectionRootPath = useMemo(() => {
    const rootSegment = pathname.split('/').filter(Boolean)[0];
    return rootSegment ? '/' + rootSegment : pathname;
  }, [pathname]);

  const matchedSectionId = useMemo(() => {
    const currentSubcategory = activeFilters.subcategory?.[0] || searchParams?.get('subcategory');

    for (const section of browseSections) {
      if (section.href) {
        try {
          const target = new URL(section.href, 'https://houseofdiams.local');
          const legacyMatch = currentSubcategory &&
            target.pathname === pathname &&
            target.searchParams.get('subcategory') === currentSubcategory;
          const nestedMatch = target.search === '' &&
            (target.pathname === pathname || pathname.startsWith(target.pathname + '/'));
          if (legacyMatch || nestedMatch) return section.id;
        } catch {}
      }

      for (const option of section.options ?? []) {
        try {
          const target = new URL(option.href, 'https://houseofdiams.local');
          const legacyMatch = currentSubcategory &&
            target.pathname === pathname &&
            target.searchParams.get('subcategory') === currentSubcategory;
          if (legacyMatch || target.pathname === pathname) return section.id;
        } catch {
          continue;
        }
      }
    }

    return '';
  }, [activeFilters.subcategory, browseSections, pathname, searchParams]);

  const allSectionId = '__all__';
  const resolvedActiveSectionId = matchedSectionId || allSectionId;
  const [activeSectionId, setOptimisticActiveSectionId] = useOptimistic(resolvedActiveSectionId);
  const [pendingHref, setPendingHref] = useState('');
  const railRef = useRef(null);
  const [canScrollBackward, setCanScrollBackward] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const hasPendingNavigation = useMemo(() => {
    if (!pendingHref) return false;
    try {
      const target = new URL(pendingHref, 'https://houseofdiams.local');
      const currentSearch = searchParams?.toString();
      return target.pathname !== pathname || target.search !== (currentSearch ? '?' + currentSearch : '');
    } catch {
      return false;
    }
  }, [pathname, pendingHref, searchParams]);

  const isOptionActive = (href) => {
    try {
      const target = new URL(href, 'https://houseofdiams.local');
      if (target.search === '' && target.pathname === pathname) return true;

      const filterKeys = ['category', 'subcategory', 'option', 'shape', 'style', 'metal', 'certificate'];
      const targetEntries = filterKeys
        .map((key) => [key, target.searchParams.get(key)])
        .filter(([, value]) => Boolean(value));

      if (targetEntries.length === 0) return false;
      return targetEntries.every(([key, value]) => activeFilters[key]?.includes(value));
    } catch {
      return false;
    }
  };

  const navigateBrowseHref = (href) => {
    if (onBrowseNavigate?.(href)) {
      setPendingHref('');
      return;
    }
    setPendingHref(href);
    router.push(href);
  };

  const tabSections = useMemo(
    () => [{ id: allSectionId, title: 'All', href: collectionRootPath, options: [] }, ...browseSections],
    [browseSections, collectionRootPath]
  );

  const activeSection = browseSections.find((section) => section.id === activeSectionId) ?? null;
  const visualOptions = useMemo(() => {
    const sourceOptions = activeSection
      ? activeSection.options.map((option) => ({ ...option, sectionId: activeSection.id }))
      : browseSections.flatMap((section) =>
          (section.options ?? []).map((option) => ({ ...option, sectionId: section.id }))
        );
    const seen = new Set();

    return sourceOptions.reduce((options, option) => {
      const key = option.href || `${option.sectionId}:${option.label}`;
      if (seen.has(key)) return options;
      seen.add(key);
      options.push({ ...option, id: `${option.sectionId}-${option.label}-${key}` });
      return options;
    }, []);
  }, [activeSection, browseSections]);
  const categoryBannerImage = desktopImageUrl || mobileImageUrl;
  const bannerImage = activeSection?.iconUrl || categoryBannerImage;
  const bannerHref = activeSection?.href || ctaHref || collectionRootPath;
  const bannerLabel = activeSection?.title || title;

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;

    rail.scrollLeft = 0;

    const updateScrollState = () => {
      const remainingScroll = rail.scrollWidth - rail.clientWidth - rail.scrollLeft;
      setCanScrollBackward(rail.scrollLeft > 2);
      setCanScrollForward(remainingScroll > 2);
    };

    const handleRailScroll = () => {
      updateScrollState();
    };

    updateScrollState();
    rail.addEventListener('scroll', handleRailScroll, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(rail);

    return () => {
      rail.removeEventListener('scroll', handleRailScroll);
      resizeObserver.disconnect();
    };
  }, [visualOptions]);

  const scrollRailForward = () => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: Math.max(260, rail.clientWidth * 0.75), behavior: 'smooth' });
  };

  const scrollRailBackward = () => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: -Math.max(260, rail.clientWidth * 0.75), behavior: 'smooth' });
  };

  const handleBrowseClick = (event, sectionId, href) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;

    event.preventDefault();
    startTransition(() => {
      if (sectionId) setOptimisticActiveSectionId(sectionId);
      navigateBrowseHref(href);
    });
  };

  return (
    <section className="border-b border-black/10 bg-white pb-7 pt-[var(--space-7)] sm:pb-9 sm:pt-[var(--space-8)] lg:pt-[calc(146px+var(--space-8))]" aria-labelledby="shop-collection-heading">
      <div className={`flex flex-col gap-5 px-4 sm:px-7 lg:flex-row lg:items-end lg:justify-between ${wideGutter ? 'lg:px-[50px]' : 'lg:px-[52px]'}`}>
        <div>
          <nav aria-label="Breadcrumb" className="my-3 flex items-center gap-3 text-[12px] font-normal tracking-[0.01em] text-gray-700">
            <Link href="/" className="text-gray-700 no-underline hover:text-gray-900">Home</Link>
            <span aria-hidden="true" className="text-gray-700">/</span>
            <span>{title}</span>
          </nav>
          <h1
            id="shop-collection-heading"
            className="section-title text-left text-[clamp(1.35rem,2.2vw,2rem)] font-medium uppercase leading-none tracking-[0.025em] text-[var(--color-brand-primary,#000)]"
          >
            {heading || `Explore ${title}`}
          </h1>
        </div>

        {browseSections.length > 0 ? (
          <nav aria-label="Browse collection sections" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-7 sm:px-7 lg:mx-0 lg:max-w-[62%] lg:px-0 [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max items-center gap-7 border-b border-black/10">
              {tabSections.map((section) => {
                const isActive = section.id === activeSectionId;
                const href = section.href || pathname;
                return (
                  <Link
                    key={section.id}
                    href={href}
                    aria-current={isActive ? 'page' : undefined}
                    className={'relative pb-3 font-[family-name:var(--font-family-primary)] text-[12px] font-medium uppercase tracking-[0.08em] text-[#0A1628] no-underline transition-opacity hover:opacity-60 ' + (isActive ? 'after:absolute after:inset-x-0 after:bottom-[-1px] after:h-[2px] after:bg-[#0A1628]' : '')}
                    onClick={(event) => handleBrowseClick(event, section.id, href)}
                  >
                    {section.title}
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : null}
      </div>

      <div className="relative mt-[var(--space-section-block)] px-1.5 sm:px-5 lg:px-[60px]">
        <div
          ref={railRef}
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={(activeSection?.title || title) + ' visual options'}
        >
        <Link
          href={bannerHref}
          className="group relative aspect-[2/3] h-auto w-[36vw] min-w-[140px] max-w-[256px] shrink-0 snap-start overflow-hidden bg-[#F2F1EE] text-white no-underline lg:h-[320px] lg:w-[516px] lg:max-w-none lg:aspect-auto"
        >
          {bannerImage ? (
            <picture>
              {!activeSection && mobileImageUrl ? <source media="(max-width: 640px)" srcSet={mobileImageUrl} /> : null}
              <img src={bannerImage} alt={activeSection ? bannerLabel : imageAlt || title} className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.025]" />
            </picture>
          ) : (
            <div className="h-full w-full bg-[linear-gradient(145deg,#172238,#0A1628)]" aria-hidden="true" />
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" aria-hidden="true" />
          <span className="absolute inset-x-0 bottom-0 flex min-h-[52px] items-end p-4 text-left font-[family-name:var(--font-family-primary)] text-[12px] font-medium uppercase leading-[1.3] tracking-[0.07em] [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
            <span className="shop-hero-label-underline">{bannerLabel}</span>
          </span>
        </Link>

        {visualOptions.map((option) => {
          const isActive = isOptionActive(option.href);
          const isPending = hasPendingNavigation && pendingHref === option.href;
          const hasIcon = option.type === 'icon' && option.iconUrl;
          const isSwatch = option.type === 'swatch';

          return (
            <Link
              key={option.id}
              href={option.href}
              aria-current={isActive ? 'page' : undefined}
            className={'group relative aspect-[2/3] h-auto w-[36vw] min-w-[140px] max-w-[256px] shrink-0 snap-start overflow-hidden border bg-[#F6F6F4] no-underline transition-[border-color,opacity] sm:h-[320px] sm:w-[256px] sm:aspect-auto ' + (isActive || isPending ? 'border-[#0A1628]' : 'border-transparent')}
              style={{ opacity: hasPendingNavigation && !isPending ? 0.58 : 1 }}
              onClick={(event) => handleBrowseClick(event, null, option.href)}
            >
              <span className="absolute inset-0 flex items-center justify-center">
                {hasIcon ? (
                  <img src={option.iconUrl} alt="" className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.025]" />
                ) : isSwatch ? (
                  <span className="absolute inset-0" style={{ background: option.colorHex || '#D9D9D9' }} aria-hidden="true" />
                ) : (
                  <span className="font-[family-name:var(--font-family-primary)] text-[32px] font-light text-black/15" aria-hidden="true">◇</span>
                )}
              </span>
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" aria-hidden="true" />
              <span className="absolute inset-x-0 bottom-0 flex min-h-[52px] items-end px-4 py-4 text-left font-[family-name:var(--font-family-primary)] text-[12px] font-medium uppercase leading-[1.3] tracking-[0.07em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
                <span className="shop-hero-label-underline">{option.label}{isPending ? '…' : ''}</span>
              </span>
            </Link>
          );
        })}
        </div>

        {canScrollBackward ? (
          <button
            type="button"
            aria-label="Scroll collection options backward"
            onClick={scrollRailBackward}
            className={`absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-black/15 bg-white text-[#0A1628] shadow-[0_8px_24px_rgba(10,22,40,0.14)] transition-colors hover:bg-[#0A1628] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A1628] sm:flex ${wideGutter ? 'lg:left-[60px]' : ''}`}
          >
            <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : null}

        {canScrollForward ? (
          <button
            type="button"
            aria-label="Scroll collection options forward"
            onClick={scrollRailForward}
            className={`absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-black/15 bg-white text-[#0A1628] shadow-[0_8px_24px_rgba(10,22,40,0.14)] transition-colors hover:bg-[#0A1628] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A1628] sm:flex ${wideGutter ? 'lg:right-[60px]' : ''}`}
          >
            <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  );
}
