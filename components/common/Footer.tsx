'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import ReactCountryFlag from 'react-country-flag';
import { useCurrency } from '@/context/CurrencyContext';
import type { NavbarRenderItem } from '@/lib/navbar';
import { getSafeContactHref } from '@/lib/contact-links';
import { fetchPublicJson } from '@/lib/client/public-json';

const PAYMENT_METHODS = [
  { name: 'Visa', src: '/payment svgs/visa 1.svg' },
  { name: 'Mastercard', src: '/payment svgs/mastercard-mono 1.svg' },
  { name: 'Apple Pay', src: '/payment svgs/apple-pay 1.svg' },
  { name: 'American Express', src: '/payment svgs/american-express 1.svg' },
];
const SOCIAL = [
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/houseofdiams_?igsh=MXg0cDhqMTcxaWxycA%3D%3D&utm_source=qr',
    src: '/HOD specs/instagram-logo 1.svg',
  },
  {
    name: 'Pinterest',
    href: 'https://pin.it/3G2ogNJNq',
    src: '/HOD specs/pinterest 1.svg',
  },
  
];

type FooterCategory = {
  id: string;
  name: string;
  slug: string;
};

type CollectionPageConfigRow = {
  page_enabled?: boolean | null;
  show_in_footer?: boolean | null;
  showcase_cta_href?: string | null;
  showcase_cta_label?: string | null;
};

export type InitialContactRows = ContactInfoRow[];

type ContactInfoRow = {
  id?: number | string | null;
  sort_order?: number | null;
  label?: string | null;
  value?: string | null;
  note?: string | null;
  href?: string | null;
};

const FALLBACK_CONTACT_ROWS: ContactInfoRow[] = [
  { id: 'fallback-email', label: 'Email', value: 'info@houseofdiams.com', href: 'mailto:info@houseofdiams.com' },
  { id: 'fallback-phone', label: 'Phone & WhatsApp', value: '+91 93285 36178', href: 'tel:+919328536178' },
  { id: 'fallback-new-york', label: 'Address', value: '36 W 44th Street, Suite 1000B, New York, 10036, USA' },
];

function ColLink({ href, children }: { href: string; children: React.ReactNode }) {
  const className = "group block py-[8px] text-[14px] font-normal leading-relaxed text-white/80 no-underline transition-colors duration-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
  const style = { fontFamily: 'var(--font-family-secondary)' };

  return href.startsWith('/') ? (
    <Link href={href} prefetch className={className} style={style}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} style={style}>
      {children}
    </a>
  );
}

function ColTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="m-0 mb-[var(--space-4)] text-[13px] font-semibold uppercase tracking-[0.14em] text-white"
      style={{ fontFamily: 'var(--font-family-tertiary)' }}
    >
      {children}
    </p>
  );
}

function FooterAccordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const sync = () => {
      setIsMobile(media.matches);
      setIsOpen(!media.matches);
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return (
    <details className="footer-accordion group" open={isMobile ? isOpen : true} onToggle={(event) => { if (isMobile) setIsOpen((event.currentTarget as HTMLDetailsElement).open); }}>
      <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
        <span className="footer-accordion-title"><ColTitle>{title}</ColTitle><ChevronDown className="footer-accordion-chevron" size={16} strokeWidth={1.5} /></span>
      </summary>
      <div className="footer-accordion-content">{children}</div>
    </details>
  );
}

function CurrencySelector() {
  const { currencies, selected, changeCurrency, isLoadingRate, isConversionAvailable } = useCurrency();

  return (
    <div className="flex flex-wrap items-center gap-2 text-white" style={{ fontFamily: 'var(--font-family-secondary)' }}>
      <SelectPrimitive.Root value={selected.code} onValueChange={changeCurrency} disabled={isLoadingRate || !isConversionAvailable}>
        <SelectPrimitive.Trigger
          aria-label="Select country and currency"
          className="group inline-flex h-10 min-w-[230px] items-center justify-between gap-3 rounded-[4px] border border-white/10 bg-white/[0.14] px-3 text-left outline-none transition-colors duration-200 hover:bg-white/[0.2] focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-55 max-sm:min-w-full"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full">
              <ReactCountryFlag
                countryCode={selected.countryCode}
                svg
                aria-label={selected.label}
                alt=""
                style={{ width: '18px', height: '18px', borderRadius: '999px' }}
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-medium normal-case text-white">
                {selected.label} ({selected.code})
              </span>
            </span>
          </span>
          <SelectPrimitive.Icon asChild>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-white/75 transition group-data-[state=open]:rotate-180">
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.8} />
            </span>
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            side="top"
            sideOffset={10}
            align="start"
            onWheel={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
            className="z-[1500] max-h-[320px] min-w-[var(--radix-select-trigger-width)] touch-pan-y overflow-hidden rounded-[4px] border border-white/20 bg-[var(--color-brand-primary)] p-1.5 text-white shadow-[0_20px_55px_rgba(0,0,0,0.35)]"
          >
            <SelectPrimitive.ScrollUpButton className="flex h-7 cursor-default items-center justify-center text-white/70">
              <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.8} />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport
              onWheel={(event) => event.stopPropagation()}
              onTouchMove={(event) => event.stopPropagation()}
              className="max-h-[260px] touch-pan-y overflow-y-auto overscroll-contain"
            >
              {currencies.map((option) => (
                <SelectPrimitive.Item
                  key={option.code}
                  value={option.code}
                  className="relative flex cursor-pointer select-none items-center gap-3 rounded-[2px] px-3 py-2.5 pr-9 outline-none transition-colors duration-200 focus:bg-white/15 data-[state=checked]:bg-white/20 data-[state=checked]:text-white"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full">
                    <ReactCountryFlag
                      countryCode={option.countryCode}
                      svg
                      aria-label={option.label}
                      alt=""
                      style={{ width: '18px', height: '18px', borderRadius: '999px' }}
                    />
                  </span>
                  <SelectPrimitive.ItemText>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[13px] font-medium normal-case tracking-[0.01em]">{option.label}</span>
                      <span className="mt-0.5 text-[10px] uppercase tracking-[0.16em] opacity-60">
                        {option.code} {option.symbol}
                      </span>
                    </span>
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-3 flex h-5 w-5 items-center justify-center">
                    <Check className="h-4 w-4" strokeWidth={1.8} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="flex h-7 cursor-default items-center justify-center text-white/70">
              <ChevronUp className="h-3.5 w-3.5 rotate-180" strokeWidth={1.8} />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {isLoadingRate ? <span className="text-[10px] uppercase tracking-[0.16em] text-white/45">Updating</span> : !isConversionAvailable ? <span className="text-[10px] uppercase tracking-[0.16em] text-white/45">USD only</span> : null}
    </div>
  );
}

export default function Footer({ navItems = [], initialContactRows = null }: { navItems?: NavbarRenderItem[]; initialContactRows?: InitialContactRows | null }) {
  const [serviceCategories, setServiceCategories] = useState<FooterCategory[]>([]);
  const [collectionConfig, setCollectionConfig] = useState<CollectionPageConfigRow | null>(null);
  const [contactRows, setContactRows] = useState<ContactInfoRow[]>(initialContactRows ?? []);
  const visibleNavbarHrefs = useMemo(
    () => new Set(navItems.map((item) => item.href?.split('?')[0]?.replace(/\/$/, '') || '/').filter(Boolean)),
    [navItems]
  );

  useEffect(() => {
    let ignore = false;

    const loadCategories = async () => {
      const [footerResult, contactResult] = await Promise.all([
        fetchPublicJson<{ categories?: FooterCategory[]; collectionConfig?: CollectionPageConfigRow | null }>('/api/public/footer-content').catch(() => null),
        // The server already rendered the admin's contact details; only fetch when it could not.
        initialContactRows ? Promise.resolve(null) : fetchPublicJson<{ items?: ContactInfoRow[] }>('/api/public/contact/info').catch(() => null),
      ]);

      if (ignore) return;
      if (footerResult?.ok) {
        const payload = footerResult.payload;
        if (Array.isArray(payload?.categories)) setServiceCategories(payload.categories);
        setCollectionConfig(payload?.collectionConfig ?? null);
      }

      if (contactResult?.ok && Array.isArray(contactResult.payload?.items)) {
        setContactRows(contactResult.payload.items);
      }

    };

    void loadCategories();

    return () => {
      ignore = true;
    };
  }, []);

  const visibleServiceCategories = useMemo(
    () => serviceCategories.filter((item) => item.slug && item.name && visibleNavbarHrefs?.has(`/${item.slug}`)),
    [serviceCategories, visibleNavbarHrefs]
  );
  const showCollectionLink = Boolean(collectionConfig?.page_enabled && collectionConfig?.show_in_footer);
  const collectionHref = collectionConfig?.showcase_cta_href || '/collection';
  const collectionLabel = collectionConfig?.showcase_cta_label || 'Collection';
  const footerContactRows = useMemo(
    () => (contactRows.length ? contactRows : FALLBACK_CONTACT_ROWS).filter((row) => row.value?.trim()),
    [contactRows]
  );

  return (
    <footer
      className="site-footer w-full border-t border-white/15 px-[var(--space-4)] pt-[var(--space-10)] text-white sm:px-[var(--space-6)] lg:px-[var(--space-8)]"
      style={{ backgroundColor: 'var(--color-brand-primary)', fontFamily: 'var(--font-family-secondary)' }}
    >
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-y-[var(--space-10)] pb-[var(--space-10)] lg:grid-cols-[minmax(0,3fr)_minmax(170px,0.8fr)_minmax(260px,1.2fr)] lg:gap-x-[var(--space-10)]">
        <div className="grid grid-cols-1 gap-y-[var(--space-4)] sm:grid-cols-3 sm:gap-x-[var(--space-8)] lg:max-w-[860px]">
          <FooterAccordion title="NAVIGATE">
            <ColLink href="/">Home</ColLink>
            {showCollectionLink ? <ColLink href={collectionHref}>{collectionLabel}</ColLink> : null}
            <ColLink href="/about">About Us</ColLink>
            <ColLink href="/bespoke">Bespoke</ColLink>
            <ColLink href="/blog">Blog</ColLink>
            <ColLink href="/education">Education</ColLink>
            <ColLink href="/contact">Contact</ColLink>
          </FooterAccordion>

          <FooterAccordion title="JEWELLERY">
            {visibleServiceCategories.map((category) => (
              <ColLink key={category.id} href={`/${encodeURIComponent(category.slug)}`}>
                {category.name}
              </ColLink>
            ))}
          </FooterAccordion>

          <FooterAccordion title="SUPPORT">
            <ColLink href="/faq">FAQ</ColLink>
            <ColLink href="/shipping">Shipping</ColLink>
            <ColLink href="/returns">Returns</ColLink>
            <ColLink href="/terms">Terms &amp; Conditions</ColLink>
            <ColLink href="/privacy-policy">Privacy Policy</ColLink>
          </FooterAccordion>
        </div>

        <div className="flex flex-col items-start lg:pl-[var(--space-4)]">
          <ColTitle>FOLLOW US</ColTitle>
          <div className="flex gap-[var(--space-3)]">
            {SOCIAL.map((item) => (
              <a
                key={item.name}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.name}
                className="flex h-12 w-12 items-center justify-center text-white transition-opacity duration-200 hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <img src={item.src} alt="" className="h-7 w-7 object-contain" loading="lazy" />
              </a>
            ))}
          </div>
        </div>

        <div className="w-full text-left sm:col-span-2 lg:col-span-1 lg:max-w-[420px]" aria-label="Contact information">
          <ColTitle>CONTACT US</ColTitle>
            <div className="flex flex-col gap-2">
              {footerContactRows.map((row, index) => {
                const value = row.value?.trim();
                if (!value) return null;
                const href = getSafeContactHref(row.href);
                const key = row.id ?? `${row.label}-${index}`;
                const content = <span>{value}{row.note?.trim() ? <span className="block text-white/55">{row.note.trim()}</span> : null}</span>;
                return href ? (
                  <a key={key} href={href} className="block py-1.5 text-[13px] leading-relaxed text-white/75 no-underline transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">{content}</a>
                ) : (
                  <p key={key} className="m-0 py-1.5 text-[13px] leading-relaxed text-white/75">{content}</p>
                );
              })}
            </div>
          </div>
      </div>
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-[var(--space-10)] gap-y-[var(--space-6)] py-[var(--space-6)] text-[11px] text-white/60">
        <div className="flex min-w-0 flex-col">
          <Link
            href="/"
            className="inline-block whitespace-nowrap text-[clamp(20px,10vw,48px)] font-bold leading-none tracking-[0.06em] text-white no-underline transition-opacity hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:text-[clamp(20px,6.3vw,62px)]"
            style={{ fontFamily: 'var(--font-family-logo1, Cinzel, serif)', fontWeight: 600, fontVariationSettings: '"wght" 600', fontSynthesis: 'none' }}
          >
            House of Diams
          </Link>
          <span className="mt-2">© {new Date().getFullYear()} House of Diams. All rights reserved.</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-[var(--space-8)] gap-y-[var(--space-4)]">
          <CurrencySelector />
          <div className="flex flex-wrap items-center gap-6 pr-20 lg:pr-28" aria-label="Accepted payment methods">
            {PAYMENT_METHODS.map((method) => (
              <span key={method.name} className="flex items-center justify-center">
                <img src={method.src} alt={method.name} className="h-11 w-11 object-contain" loading="lazy" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
