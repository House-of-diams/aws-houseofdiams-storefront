'use client';

import Link from 'next/link';
import { cinzelFont } from '@/app/fonts';
import type { HomeDiamondInfoConfig, HomeDiamondInfoItem } from '@/lib/home-data';
import { sanitizeInlineSvg } from '@/lib/sanitize-html';
import { mediaUrl } from '@/lib/media-url';

const FALLBACK_FEATURES: HomeDiamondInfoItem[] = [
  {
    sort_order: 1,
    iconSvg:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17.3l-5.2 3 1.4-5.9L3.5 10l6-.5L12 4l2.5 5.5 6 .5-4.7 4.4 1.4 5.9z"/></svg>',
    title: 'Best rated jeweler',
    description: 'Trusted by customers for quality, service, and craftsmanship.',
    is_active: true,
  },
  {
    sort_order: 2,
    iconSvg:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 10h6"/><path d="M12 7v10"/><path d="M9 14h6"/></svg>',
    title: 'Best price guarantee',
    description: 'Transparent pricing with no hidden surprises.',
    is_active: true,
  },
  {
    sort_order: 3,
    iconSvg:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/></svg>',
    title: 'Guaranteed for life',
    description: 'Made to last with long-term confidence and support.',
    is_active: true,
  },
  {
    sort_order: 4,
    iconSvg:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15a4 4 0 0 1 4-4h1"/><path d="M15 11h1a4 4 0 0 1 4 4"/><path d="M9 18h6"/><path d="M8 7a4 4 0 1 1 8 0v4H8z"/></svg>',
    title: 'Unbiased human experts',
    description: 'Real guidance from people, not pressure-driven selling.',
    is_active: true,
  },
];

const FALLBACK_CONFIG: HomeDiamondInfoConfig = {
  videoEnabled: true,
  layoutMode: 'split_video_text',
  eyebrow: 'Learn about the difference',
  sectionHeading: 'This is the future of jewelry buying.',
  sectionSubtext: 'We didn’t say that. Our customers did.',
  ctaLabel: 'Learn about our peace of mind guarantee',
  ctaLink: '/contact',
};

function normalizeFeatures(items?: HomeDiamondInfoItem[]) {
  const source = items?.filter((item) => item.is_active !== false && (item.title || item.description || item.iconSvg))?.length
    ? items.filter((item) => item.is_active !== false && (item.title || item.description || item.iconSvg))
    : FALLBACK_FEATURES;

  return [...source]
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 4)
    .map((item, index) => ({
      ...FALLBACK_FEATURES[index],
      ...item,
      iconSvg: item.iconSvg?.trim() || FALLBACK_FEATURES[index].iconSvg,
      title: item.title?.trim() || FALLBACK_FEATURES[index].title,
      description: item.description?.trim() || FALLBACK_FEATURES[index].description,
    }));
}

function isExternalHref(href?: string) {
  return !!href && /^(https?:)?\/\//.test(href);
}

function isSvgMarkup(value?: string | null) {
  return !!value && value.trim().startsWith('<svg');
}

function resolveIconSource(value?: string | null) {
  if (!value) return '';
  if (isSvgMarkup(value)) return '';

  return mediaUrl(value);
}

export default function DiamondInfoSequence({
  items = [],
  config,
}: {
  items?: HomeDiamondInfoItem[];
  config?: HomeDiamondInfoConfig;
}) {
  const resolvedConfig = {
    ...FALLBACK_CONFIG,
    ...config,
  };

  const features = normalizeFeatures(items);
  const hasVideo = Boolean(resolvedConfig.videoEnabled && resolvedConfig.videoUrl);
  const ctaHref = resolvedConfig.ctaLink?.trim() || '';
  const heading = resolvedConfig.sectionHeading?.trim() || FALLBACK_CONFIG.sectionHeading;
  const subtext = resolvedConfig.sectionSubtext?.trim() || FALLBACK_CONFIG.sectionSubtext;
  const ctaLabel = resolvedConfig.ctaLabel?.trim() || FALLBACK_CONFIG.ctaLabel;

  return (
    <section className="bg-white py-0 md:py-0 lg:py-0">
      <div className="w-full overflow-hidden border-y border-[#DCE4F0] bg-[#F5F7FC]">
        <div className="grid lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-stretch">
          <div className="relative min-h-[260px] overflow-hidden bg-[#111111] sm:min-h-[340px] lg:min-h-0 lg:h-full lg:self-stretch">
            {hasVideo ? (
              <video
                className="absolute left-1/2 top-1/2 h-full w-full min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 object-cover object-center"
                src={resolvedConfig.videoUrl}
                poster={resolvedConfig.videoPosterUrl}
                autoPlay
                muted
                loop
                playsInline
                preload="none"
              />
            ) : resolvedConfig.videoPosterUrl ? (
              <img
                src={resolvedConfig.videoPosterUrl}
                alt={heading}
                className="absolute left-1/2 top-1/2 h-full w-full min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 object-cover object-center"
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_28%),linear-gradient(135deg,#0A1628,#20304A)]" />
            )}
          </div>

          <div className="flex items-center bg-[#F5F7FC]">
            <div className="w-full px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-8 xl:px-12">
              <div className="mx-auto max-w-[520px]">
                <h2 className={`${cinzelFont.variable} font-primary-display section-title text-center font-light leading-[1.08] tracking-[0.01em] text-[#0A1628] max-md:text-[28px] lg:text-left`} style={{ fontSize: 'clamp(24px, 4.5vw, 54px)', fontWeight: 400 }}>
                  {heading}
                </h2>

                <p className="mt-4 text-center text-[14px] leading-[1.75] text-[#4E5667] sm:text-[15px] lg:text-left">
                  {subtext}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
                  {features.map((feature) => (
                    <div key={`${feature.sort_order}-${feature.title}`} className="flex items-start gap-3 rounded-[20px] border border-[#DCE4F0] bg-white/75 px-3.5 py-3.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#CBD7E8] bg-white text-[#0A1628]">
                        {isSvgMarkup(feature.iconSvg) ? (
                          <span
                            className="block h-4.5 w-4.5 [&>svg]:h-4.5 [&>svg]:w-4.5"
                            dangerouslySetInnerHTML={{ __html: sanitizeInlineSvg(feature.iconSvg ?? '') }}
                          />
                        ) : feature.iconSvg ? (
                          <img src={resolveIconSource(feature.iconSvg)} alt={feature.title} className="h-4.5 w-4.5 object-contain" />
                        ) : null}
                      </div>
                      <div>
                        <h3 className="text-[15px] font-medium leading-[1.25] text-[#0A1628] sm:text-[16px]">{feature.title}</h3>
                        <p className="mt-1 text-[13px] leading-[1.65] text-[#292727] sm:text-[13.5px]">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-center lg:justify-start">
                  <Link
                    href="/about"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#0A1628] bg-[#0A1628] px-6 font-[family-name:var(--font-family-button)] text-[13px] font-medium text-white transition-colors hover:bg-transparent hover:text-[#0A1628] sm:text-[14px]"
                  >
                    About Us
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
