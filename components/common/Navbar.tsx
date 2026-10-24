'use client';
import { useCurrency } from '@/context/CurrencyContext';
import { useEffect, useMemo, useRef, useState, type AnchorHTMLAttributes, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  type NavbarRenderItem,
  type NavbarRenderSection,
} from '@/lib/navbar';
import { useWishlistStore } from '@/lib/hooks/useWishlistStore';
import { useCart } from '@/lib/hooks/useCart';
import { fetchPublicJson } from '@/lib/client/public-json';

const METAL_COLORS: Record<string, string> = {
  yellow: 'linear-gradient(135deg,#F5D76E,#20304A)',
  rose: 'linear-gradient(135deg,#F0C4B0,#D4967A)',
  white: 'linear-gradient(135deg,#F0F0F0,#D8D8D8)',
  platinum: 'linear-gradient(135deg,#E8E8E8,#C0C0C0)',
  default: 'linear-gradient(135deg,#E5E7EB,#9CA3AF)',
};

type SearchItem = {
  dbId?: string
  slug: string
  name: string
  shortMeta: string
  imageUrl?: string
  priceFrom: number
};

const STATIC_SEARCH_SUGGESTIONS = [
  'Stackable rings',
  'Stackable diamond bands',
  'Solitaire diamond pendant',
  'Classic solitaire engagement rings',
  'Diamond engagement rings',
  'Lab grown diamond rings',
  'Wedding bands',
  'Diamond earrings',
  'Diamond bracelets',
];

async function loadSearchItems(query: string, signal?: AbortSignal): Promise<SearchItem[]> {
  // Search results are public and short-lived cached by the API, so repeat
  // searches can be answered by the browser or CDN.
  const response = await fetch(`/api/public/products/search?q=${encodeURIComponent(query.trim())}`, {
    cache: query.trim() ? 'default' : 'force-cache',
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(payload?.items)) {
    throw new Error(payload?.error || 'Unable to load product search.');
  }
  return payload.items as SearchItem[];
}

function SmartNavLink({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const isInternalRoute = href.startsWith('/') && !href.startsWith('//');
  return isInternalRoute ? <Link href={href} {...props} /> : <a href={href} {...props} />;
}

function MetalDot({ type, colorHex }: { type: keyof typeof METAL_COLORS; colorHex?: string | null }) {
  const color = typeof colorHex === 'string' && colorHex.trim().length > 0
    ? colorHex.trim()
    : METAL_COLORS[type];

  return (
    <span
      className="inline-block h-5 w-5 flex-shrink-0 rounded-full border-[5px] bg-transparent"
      style={{ borderColor: color }}
    />
  );
}

function MegaSection({ section, onNavigate, onPreview }: { section: NavbarRenderSection; onNavigate?: () => void; onPreview?: (imageUrl: string, imageAlt: string) => void }) {
  const entries = [
    ...(section.metals?.map((metal) => ({
      kind: 'metal' as const, key: `${metal.type}-${metal.label}`, label: metal.label,
      href: metal.href, type: metal.type, colorHex: metal.colorHex,
    })) ?? []),
    ...(section.links?.map((link) => ({
      kind: 'link' as const, key: `${section.title}-${link.label}`, label: link.label,
      href: link.href, iconUrl: link.iconUrl,
    })) ?? []),
  ];
  const rowCount = Math.min(12, entries.length);

  return (
    <div className="flex flex-col">
      <div
        className="mb-[18px] border-0 pb-0 text-[17px] font-semibold leading-[1.2] tracking-[-0.01em] text-[#050505]"
        style={{ fontFamily: 'var(--font-family-primary, Montserrat, sans-serif)' }}
      >
        <span>{section.title}</span>
      </div>

      {entries.length > 0 ? (
        <div
          className="grid grid-flow-col gap-x-6 gap-y-1"
          style={{
            gridTemplateRows: `repeat(${rowCount}, minmax(0, auto))`,
            gridAutoColumns: 'minmax(140px, max-content)',
          }}
        >
          {entries.map((entry) => (
            <SmartNavLink
              key={entry.key}
              href={entry.href}
              onClick={onNavigate}
              onMouseEnter={() => { if (entry.kind === 'link' && entry.iconUrl) onPreview?.(entry.iconUrl, entry.label) }}
              className="block min-h-[31px] py-[4px] text-[14px] font-normal leading-[1.45] tracking-[-0.01em] text-[#050505] no-underline transition-colors duration-200 hover:text-[#8b6a3d]"
              style={{ fontFamily: 'Inter, var(--font-family-secondary, sans-serif)' }}
            >
              {entry.label}
            </SmartNavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getDefaultMegaPreview(item: NavbarRenderItem) {
  for (const section of item.mega?.sections ?? []) {
    const link = section.links?.find((entry) => entry.iconUrl)
    if (link?.iconUrl) return { imageUrl: link.iconUrl, imageAlt: link.label }
  }
  return item.mega?.featuredImage ? { imageUrl: item.mega.featuredImage.imageUrl, imageAlt: item.mega.featuredImage.imageAlt || item.label } : null
}

function hasMegaMenu(item: NavbarRenderItem) {
  return item.navigationType !== 'direct_link' && Boolean(item.mega)
}

function getMobileSectionEntries(section: NavbarRenderSection) {
  const metalEntries =
    section.metals?.map((metal) => ({
      label: metal.label,
      href: metal.href,
      icon: <MetalDot type={metal.type as keyof typeof METAL_COLORS} colorHex={metal.colorHex} />,
    })) ?? [];

  const linkEntries =
    section.links?.map((link) => ({
      label: link.label,
      href: link.href,
      icon: link.iconUrl ? (
        <img
          src={link.iconUrl}
          alt={link.label}
          className="h-5 w-5 flex-shrink-0 object-contain"
        />
      ) : null,
    })) ?? [];

  return [...metalEntries, ...linkEntries];
}

export type InitialAnnouncement = { active: boolean; autoplay: boolean; items: Array<{ message: string; linkUrl: string; openInNewTab: boolean }> };

export default function Navbar({ navItems = [], customerAuthEnabled = false, initialAnnouncement = null }: { navItems?: NavbarRenderItem[]; customerAuthEnabled?: boolean; initialAnnouncement?: InitialAnnouncement | null }) {
  const router = useRouter();
  const { count: wishlistCount } = useWishlistStore();
  const { count: cartCount, openCart } = useCart();
  const { format: formatPrice } = useCurrency();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpenItem, setMobileOpenItem] = useState<string | null>(null);
  const [mobileOpenSection, setMobileOpenSection] = useState<string | null>(null);
  const mobileActiveItem = navItems.find((item) => item.label === mobileOpenItem) ?? null;
  const [activeMegaItem, setActiveMegaItem] = useState<string | null>(null);
  const [activeMegaPreview, setActiveMegaPreview] = useState<{ itemLabel: string; imageUrl: string; imageAlt: string } | null>(null);
  const [navHidden, setNavHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState('');
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [searchItems, setSearchItems] = useState<SearchItem[]>([]);
  const [defaultSearchItems, setDefaultSearchItems] = useState<SearchItem[]>([]);
  const [searchLoadState, setSearchLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [announcementItems, setAnnouncementItems] = useState<Array<{
    message: string;
    linkUrl: string;
    openInNewTab: boolean;
  }>>(() => initialAnnouncement
    ? initialAnnouncement.items.filter((item) => typeof item?.message === 'string' && item.message.trim())
    // Only if the server could not read it: one safe placeholder until the client fetch answers.
    : [{ message: 'Free Worldwide Insured Shipping', linkUrl: '', openInNewTab: false }]);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [announcementAutoplay, setAnnouncementAutoplay] = useState(initialAnnouncement ? initialAnnouncement.autoplay !== false : true);
  const [announcementActive, setAnnouncementActive] = useState(initialAnnouncement ? Boolean(initialAnnouncement.active) : true);
  const [authUser, setAuthUser] = useState<{ id: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const lastScrollY = useRef(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchOptionRefs = useRef<Array<HTMLElement | null>>([]);
  const defaultSearchItemsRef = useRef<SearchItem[] | null>(null);
  const megaCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileMenuCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedNavRoutesRef = useRef(new Set<string>());

  useEffect(() => {
    let frameId: number | null = null;

    const updateNavbarForScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 10);

      if (window.innerWidth < 1024) {
        setNavHidden(false);
        lastScrollY.current = currentScrollY;
        return;
      }

      const previousScrollY = lastScrollY.current;
      const scrollingDown = currentScrollY > previousScrollY + 4;
      const scrollingUp = currentScrollY < previousScrollY - 4;

      if (currentScrollY < 20) {
        setNavHidden(false);
      } else if (scrollingDown) {
        setNavHidden(true);
      } else if (scrollingUp) {
        setNavHidden(false);
      }

      lastScrollY.current = currentScrollY;
    };

    const onScroll = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updateNavbarForScroll();
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    updateNavbarForScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    const shouldLockPage = menuOpen || searchOpen;
    document.body.style.overflow = shouldLockPage ? 'hidden' : '';
    document.documentElement.style.overscrollBehavior = shouldLockPage ? 'none' : '';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overscrollBehavior = '';
    };
  }, [menuOpen, searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const controller = new AbortController();
    const query = submittedSearchQuery.trim();

    if (!query && defaultSearchItemsRef.current) {
      setSearchItems(defaultSearchItemsRef.current);
      setSearchLoadState('ready');
      return () => controller.abort();
    }

    setSearchLoadState('loading');
    void loadSearchItems(query, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        if (!query) {
          defaultSearchItemsRef.current = items;
          setDefaultSearchItems(items);
        }
        setSearchItems(items);
        setSearchLoadState('ready');
        setActiveSearchIndex(-1);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSearchItems([]);
        setSearchLoadState('error');
      });

    return () => controller.abort();
  }, [searchOpen, submittedSearchQuery]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadSearchItems('', controller.signal)
        .then((items) => {
          if (!controller.signal.aborted) {
            defaultSearchItemsRef.current = items;
            setDefaultSearchItems(items);
          }
        })
        .catch(() => { });
    }, 800);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest('[data-navbar-search-root]')) {
        setSearchOpen(false);
        setActiveSearchIndex(-1);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
        setActiveSearchIndex(-1);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [searchOpen]);

  useEffect(() => {
    return () => {
      if (megaCloseTimeoutRef.current) {
        clearTimeout(megaCloseTimeoutRef.current);
      }
      if (mobileMenuCloseTimeoutRef.current) {
        clearTimeout(mobileMenuCloseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // The server already rendered the real announcement; only fetch when it could not.
    if (initialAnnouncement) return;

    let ignore = false;

    const loadAnnouncementBar = async () => {
      try {
        const { ok, payload } = await fetchPublicJson<{ active?: unknown; autoplay?: unknown; items?: Array<{ message: string; linkUrl: string; openInNewTab: boolean }>; error?: string }>('/api/public/announcement-bar');
        if (!ok) throw new Error(payload?.error || 'Unable to load announcement bar.');
        if (ignore) return;

        setAnnouncementActive(Boolean(payload?.active));
        const nextItems = Array.isArray(payload?.items)
          ? payload.items.filter((item: { message?: unknown }) => typeof item?.message === 'string' && item.message.trim())
          : [];
        setAnnouncementItems(nextItems);
        setAnnouncementIndex(0);
        setAnnouncementAutoplay(payload?.autoplay !== false);
      } catch {
        // Retain the single safe initial fallback only when the endpoint fails.
      }
    };

    void loadAnnouncementBar();
    return () => { ignore = true; };
  }, [initialAnnouncement]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      '--hod-announcement-current-height',
      announcementActive && announcementItems.length ? 'var(--hod-announcement-height, 35px)' : '0px'
    );
    return () => {
      root.style.removeProperty('--hod-announcement-current-height');
    };
  }, [announcementActive, announcementItems.length]);

  useEffect(() => {
    const root = document.documentElement;
    const isNavCollapsed = navHidden && !searchOpen && !menuOpen;
    root.style.setProperty('--hod-navbar-visible-height', isNavCollapsed ? '38px' : 'var(--hod-navbar-height, 83px)');
    return () => {
      root.style.removeProperty('--hod-navbar-visible-height');
    };
  }, [menuOpen, navHidden, searchOpen]);

  useEffect(() => {
    if (!announcementActive || !announcementAutoplay || announcementItems.length < 2) return;
    const timer = window.setInterval(() => {
      setAnnouncementIndex((current) => (current + 1) % announcementItems.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [announcementActive, announcementAutoplay, announcementItems.length]);

  const announcementItem = announcementItems[announcementIndex] ?? null;

  useEffect(() => {
    let mounted = true;

    if (customerAuthEnabled) {
      void fetch('/api/customer-auth/session', { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error('Customer session unavailable');
        const payload = await response.json();
        if (mounted) { setAuthUser(payload.identity ?? null); setAuthReady(true); }
      }).catch(() => { if (mounted) { setAuthUser(null); setAuthReady(true); } });
      return () => { mounted = false; };
    }

    return () => { mounted = false; };
  }, [customerAuthEnabled]);

  const closeMenu = () => {
    setMenuOpen(false);
    // Keep the nested drawer in place while the outer sheet exits upward. Resetting
    // it immediately also starts the horizontal transition, which makes the close
    // animation appear to move diagonally when a category link is selected.
    if (mobileMenuCloseTimeoutRef.current) {
      clearTimeout(mobileMenuCloseTimeoutRef.current);
    }
    mobileMenuCloseTimeoutRef.current = setTimeout(() => {
      setMobileOpenItem(null);
      setMobileOpenSection(null);
      mobileMenuCloseTimeoutRef.current = null;
    }, 700);
  };

  // Esc closes the mobile menu and hands keyboard focus back to the button that opened it.
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      closeMenu();
      menuButtonRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // closeMenu only touches state setters and a timeout ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  const openMobileMenu = () => {
    if (mobileMenuCloseTimeoutRef.current) {
      clearTimeout(mobileMenuCloseTimeoutRef.current);
      mobileMenuCloseTimeoutRef.current = null;
    }
    setMobileOpenItem(null);
    setMobileOpenSection(null);
    setMenuOpen(true);
  };

  const openMegaMenu = (label: string) => {
    if (megaCloseTimeoutRef.current) {
      clearTimeout(megaCloseTimeoutRef.current);
      megaCloseTimeoutRef.current = null;
    }
    setActiveMegaItem(label);
  };

  const prefetchMegaMenu = (item: NavbarRenderItem) => {
    const hrefs = [
      item.href,
      ...(item.mega?.sections.flatMap((section) => [
        ...(section.metals?.map((metal) => metal.href) ?? []),
        ...(section.links?.map((link) => link.href) ?? []),
      ]) ?? []),
    ];

    for (const href of hrefs) {
      if (!href?.startsWith('/') || href.startsWith('//') || prefetchedNavRoutesRef.current.has(href)) continue;
      prefetchedNavRoutesRef.current.add(href);
      router.prefetch(href);
    }
  };

  const closeMegaMenu = () => {
    if (megaCloseTimeoutRef.current) {
      clearTimeout(megaCloseTimeoutRef.current);
      megaCloseTimeoutRef.current = null;
    }
    setActiveMegaItem(null);
  };

  const queueCloseMegaMenu = (label: string) => {
    if (megaCloseTimeoutRef.current) {
      clearTimeout(megaCloseTimeoutRef.current);
    }
    megaCloseTimeoutRef.current = setTimeout(() => {
      setActiveMegaItem((current) => (current === label ? null : current));
      megaCloseTimeoutRef.current = null;
    }, 250);
  };

  const handleSignOut = async () => {
    if (customerAuthEnabled) {
      const response = await fetch('/api/customer-auth/logout', { method: 'POST' });
      if (!response.ok) return;
      const payload = await response.json();
      window.location.assign(payload.redirect);
      return;
    }
    closeMenu();
    router.replace('/login');
    router.refresh();
  };

  const isShowingTextSuggestions = Boolean(searchQuery.trim()) && !submittedSearchQuery.trim();
  const filteredSearchItems = useMemo(
    () => searchItems.slice(0, submittedSearchQuery.trim() ? 12 : 16),
    [searchItems, submittedSearchQuery]
  );
  // Never leave a dead end: when a search finds nothing, offer the popular pieces
  // already loaded for the empty search panel (no extra request).
  const isSearchFallback = Boolean(submittedSearchQuery.trim()) && searchLoadState === 'ready' && !filteredSearchItems.length && defaultSearchItems.length > 0;
  const displayedSearchItems = isSearchFallback ? defaultSearchItems.slice(0, 8) : filteredSearchItems;
  const textSearchSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return [];

    // Static suggestions render immediately; cached product names are merged in as soon as they arrive.
    const productSuggestions = defaultSearchItems.map((item) => item.name);
    return [...STATIC_SEARCH_SUGGESTIONS, ...productSuggestions]
      .filter((suggestion, index, all) => {
        const normalized = suggestion.trim();
        return normalized.toLocaleLowerCase().includes(query)
          && all.findIndex((candidate) => candidate.trim().toLocaleLowerCase() === normalized.toLocaleLowerCase()) === index;
      })
      .slice(0, 6);
  }, [defaultSearchItems, searchQuery]);

  // When no text suggestion matches what was typed, search products automatically
  // after a short pause instead of waiting for Enter.
  useEffect(() => {
    const query = searchQuery.trim();
    if (!searchOpen || query.length < 2 || submittedSearchQuery.trim() || textSearchSuggestions.length) return;
    const timer = window.setTimeout(() => {
      setSubmittedSearchQuery(query);
      setActiveSearchIndex(-1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchOpen, searchQuery, submittedSearchQuery, textSearchSuggestions.length]);

  useEffect(() => {
    if (activeSearchIndex < 0) return;
    searchOptionRefs.current[activeSearchIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeSearchIndex]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    setSubmittedSearchQuery('');
    setActiveSearchIndex(-1);
  };

  const openSearch = () => {
    setSearchQuery('');
    setSubmittedSearchQuery('');
    setActiveSearchIndex(-1);
    setSearchOpen(true);
  };

  const submitSearch = (query: string) => {
    const nextQuery = query.trim();
    if (!nextQuery) return;
    setSearchQuery(nextQuery);
    setSubmittedSearchQuery(nextQuery);
    setActiveSearchIndex(-1);
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
      return;
    }

    const keyboardItems = isShowingTextSuggestions ? textSearchSuggestions : displayedSearchItems;
    if (!keyboardItems.length && event.key !== 'Enter') return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSearchIndex((current) => (current + 1) % keyboardItems.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSearchIndex((current) => (current <= 0 ? keyboardItems.length - 1 : current - 1));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (isShowingTextSuggestions && activeSearchIndex >= 0) {
        submitSearch(textSearchSuggestions[activeSearchIndex]);
        return;
      }
      // Enter on an arrow-selected product result opens it, exactly like clicking it.
      const selectedProduct = !isShowingTextSuggestions && activeSearchIndex >= 0 ? displayedSearchItems[activeSearchIndex] : undefined;
      if (selectedProduct?.slug) {
        router.push(`/shop/${selectedProduct.slug}`);
        closeSearch();
        return;
      }
      submitSearch(searchQuery);
    }
  };

  const desktopHeaderText = 'var(--color-brand-primary, #000000)';
  const desktopHeaderMuted = 'var(--color-brand-primary, #000000)';
  const desktopHeaderBorder = 'rgba(0,0,0,0.06)';
  const desktopUtilityBg = 'rgba(255,255,255,0.92)';
  const desktopHeaderBg = 'var(--color-brand-accent, #ffffff)';
  const desktopHeaderShadow = 'none';

  return (
    <>
      <style>{`
        :root {
          --hod-announcement-height: 35px;
          --hod-announcement-current-height: var(--hod-announcement-height);
          /* Mobile row contains a 34px control inside 14px vertical padding: 62px exactly. */
          --hod-navbar-height: 62px;
          --hod-navbar-visible-height: var(--hod-navbar-height);
          --hod-site-header-height: calc(var(--hod-announcement-current-height) + var(--hod-navbar-height));
          --hod-nav-hide-transform: translateY(-120%);
        }

        @media (min-width: 64rem) {
          :root {
            --hod-navbar-height: 96px;
            --hod-nav-hide-transform: translateY(-58px);
          }
        }

        #hod-announcement-bar {
          height: var(--hod-announcement-height, 35px);
          min-height: var(--hod-announcement-height, 35px);
          max-height: var(--hod-announcement-height, 35px);
          background-color: var(--color-brand-primary, #000000) !important;
          background-image: none !important;
          color: var(--color-brand-accent, #ffffff);
          opacity: 1 !important;
          mix-blend-mode: normal !important;
          isolation: isolate;
        }

        @keyframes hodAnnouncementCrossfade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .hod-announcement-message {
          animation: hodAnnouncementCrossfade 420ms ease both;
        }
        #hod-announcement-bar::before,
        #hod-announcement-bar::after {
          content: none !important;
          display: none !important;
        }

        #hod-nav,
        #hod-nav .nav-desktop-row {
          background-color: var(--color-brand-accent, #ffffff);
        }

        #hod-nav .nav-desktop-row {
          padding-inline: var(--space-4, 1rem);
        }

        @media (min-width: 64rem) {
          #hod-nav .nav-desktop-row {
            padding-inline: var(--space-8, 2rem);
          }
        }

        @media (min-width: 90rem) {
          #hod-nav .nav-desktop-row {
            padding-inline: var(--space-12, 3rem);
          }
        }

        .mega-parent.mega-open .mega-drop {
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
          transform: translateY(0) !important;
        }
      `}</style>

      {announcementActive && announcementItem ? (
        <div
          id="hod-announcement-bar"
          className="fixed left-0 right-0 top-0 z-[1001] flex items-center justify-center overflow-hidden px-[var(--space-4,1rem)] text-center text-[9px] font-medium uppercase leading-[1.2] tracking-[0.16em] select-none sm:text-[10px] sm:tracking-[0.2em]"
          style={{
            backgroundColor: 'var(--color-brand-primary, #000000)',
            backgroundImage: 'none',
            color: 'var(--color-brand-accent, #ffffff)',
            fontFamily: 'var(--font-family-secondary, Inter, Arial, sans-serif)',
            opacity: 1,
            mixBlendMode: 'normal',
            isolation: 'isolate',
          }}
        >
          <div key={`${announcementIndex}-${announcementItem.message}`} className="hod-announcement-message flex max-w-full items-center justify-center gap-x-[var(--space-3)]">
            <span className="block max-w-full">
              {announcementItem.linkUrl ? (
                <Link
                  href={announcementItem.linkUrl}
                  target={announcementItem.openInNewTab ? '_blank' : undefined}
                  rel={announcementItem.openInNewTab ? 'noreferrer' : undefined}
                  className="transition-opacity duration-200 hover:opacity-70"
                >
                  {announcementItem.message}
                </Link>
              ) : (
                <span>{announcementItem.message}</span>
              )}
            </span>
          </div>
        </div>
      ) : null}

      <header
        id="hod-nav"
        className={[
          'fixed left-0 right-0 z-[1000]',
          'transition-[transform,shadow] duration-300 ease-out',
        ].join(' ')}
        style={{
          top: announcementActive && announcementItem ? 'var(--hod-announcement-height, 35px)' : 0,
          transform: navHidden && !searchOpen && !menuOpen ? 'var(--hod-nav-hide-transform)' : 'translateY(0)',
          backgroundColor: desktopHeaderBg,
          boxShadow: desktopHeaderShadow,
          borderBottom: `1px solid ${desktopHeaderBorder}`,
        }}
      >
        <div
          className="nav-desktop-row relative h-[var(--hod-navbar-height)] py-0 lg:pb-[34px] lg:pt-0"
        >
          <div className="relative flex h-full items-center border-b border-black/[0.06] bg-white px-[3px] lg:hidden">
            <div className="order-2 -mr-1.5 ml-auto flex items-center gap-2" aria-label="Header actions">
              <button
                type="button"
                onClick={openSearch}
                aria-label="Search"
                className="group relative flex h-9 w-9 items-center justify-center border-0 bg-transparent transition-opacity duration-300 hover:opacity-75"
              >
                <img src="/Navbar svgs/search-01-stroke-rounded (1).svg" alt="" aria-hidden="true" className="h-[20px] w-[20px] object-contain opacity-75 transition-opacity group-hover:opacity-100" />
              </button>
              <button
                type="button"
                onClick={openCart}
                aria-label="Cart"
                className="group relative flex h-9 w-9 items-center justify-center border-0 bg-transparent transition-opacity duration-300 hover:opacity-75"
              >
                <img src="/Navbar svgs/handbag-simple.svg" alt="" aria-hidden="true" className="h-[20px] w-[20px] object-contain opacity-75 transition-opacity group-hover:opacity-100" />
                {cartCount ? <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#0A1628] px-1 text-[10px] text-white">{cartCount}</span> : null}
              </button>
              <button
                ref={menuButtonRef}
                onClick={() => {
                  if (menuOpen) closeMenu();
                  else openMobileMenu();
                }}
                aria-label="Menu"
                aria-expanded={menuOpen}
                className="relative flex h-11 w-9 cursor-pointer items-center justify-center border-none bg-transparent p-1"
              >
                <img
                  src="/menu-09-stroke-rounded.svg"
                  alt=""
                  aria-hidden="true"
                  className={`absolute h-[22px] w-[22px] object-contain transition-all duration-300 ease-out ${menuOpen ? 'rotate-90 scale-75 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
                />
                <img
                  src="/cancel-01-stroke-rounded.svg"
                  alt=""
                  aria-hidden="true"
                  className={`absolute h-[22px] w-[22px] object-contain transition-all duration-300 ease-out ${menuOpen ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-75 opacity-0'}`}
                />
              </button>
            </div>
            <Link
              href="/"
              className="order-1 flex min-w-0 items-center no-underline cursor-pointer"
            >
              <span
                className="whitespace-nowrap text-[19.5px] min-[360px]:text-[22px] min-[390px]:text-[23px] sm:text-[27px] font-bold"
                style={{ color: 'var(--color-brand-primary, #000000)', fontFamily: 'var(--font-family-logo1, Cinzel, serif)', fontWeight: 600, fontVariationSettings: '"wght" 600', fontSynthesis: 'none' }}
              >
                House of Diams
              </span>
            </Link>
          </div>

          <div className="relative hidden min-h-[62px] lg:flex lg:items-center lg:justify-between" style={{ color: desktopHeaderText, fontFamily: 'var(--font-family-secondary, Inter, sans-serif)' }}>
            <button type="button" data-navbar-search-root onClick={() => searchOpen ? closeSearch() : openSearch()} className="relative z-[2] flex min-w-[184px] items-center gap-2 border-b pb-2 text-[10px] font-medium uppercase tracking-[0.1em]" style={{ color: desktopHeaderText, borderColor: desktopHeaderBorder }} aria-label="Search" aria-expanded={searchOpen} aria-controls="navbar-search-panel">
              <img src="/Navbar svgs/search-01-stroke-rounded (1).svg" alt="" aria-hidden="true" className="h-[20px] w-[20px] object-contain opacity-80" />
              <span>Search</span>
            </button>
            <Link
              href="/"
              className="absolute left-1/2 top-1/2 z-[2] flex -translate-x-1/2 -translate-y-1/2 items-center whitespace-nowrap no-underline"
            >
              <span
                className="text-[clamp(22px,2.1vw,32px)] font-bold  tracking-[0.06em]"
                style={{ color: desktopHeaderText, fontFamily: 'var(--font-family-logo1, Cinzel, serif)', fontWeight: 600, fontVariationSettings: '"wght" 600', fontSynthesis: 'none' }}
              >
                House of Diams
              </span>
            </Link>

            <nav className="contents" aria-label="Primary navigation">
              <ul className="absolute left-1/2 top-[58px] flex -translate-x-1/2 items-center whitespace-nowrap list-none m-0 p-0">
                {navItems.map((item) => (
                  <li
                    key={item.label}
                    className={hasMegaMenu(item) ? `mega-parent${activeMegaItem === item.label ? ' mega-open' : ''}` : ''}
                    style={{ position: 'static' }}
                    onMouseEnter={() => {
                      if (hasMegaMenu(item)) {
                        openMegaMenu(item.label);
                        const preview = getDefaultMegaPreview(item);
                        if (preview) setActiveMegaPreview({ itemLabel: item.label, ...preview });
                        prefetchMegaMenu(item);
                      }
                    }}
                    onMouseLeave={() => {
                      if (hasMegaMenu(item)) queueCloseMegaMenu(item.label);
                    }}
                  >
                    <SmartNavLink
                      href={item.href ?? '#'}
                      onClick={closeMegaMenu}
                      className="nav-link-underline relative block px-[18px] py-[11px] text-[11px] font-semibold tracking-[0.19em] uppercase no-underline cursor-pointer transition-colors duration-300"
                      style={{
                        fontFamily: 'var(--font-family-secondary, Inter, sans-serif)',
                        color: desktopHeaderMuted,
                      }}
                    >
                      {item.label}
                    </SmartNavLink>

                    {hasMegaMenu(item) && item.mega ? (
                      <div
                        className="mega-drop absolute top-full min-h-[calc((100dvh-var(--hod-site-header-height,131px))*0.8)] overflow-hidden border-t border-black/10 bg-white"
                        style={{
                          left: '50%',
                          width: '100vw',
                          marginLeft: '-50vw',
                          opacity: 0,
                          visibility: 'hidden',
                          pointerEvents: 'none',
                          transform: 'translateY(6px)',
                          transition: 'opacity .25s ease, visibility .25s, transform .25s ease',
                          zIndex: 100,
                        }}
                        onMouseEnter={() => openMegaMenu(item.label)}
                        onMouseLeave={() => queueCloseMegaMenu(item.label)}
                        onMouseMove={(event) => {
                          const overContent = (event.target as HTMLElement).closest('[data-mega-content], a, button');
                          if (overContent) {
                            openMegaMenu(item.label);
                          } else if (!megaCloseTimeoutRef.current) {
                            queueCloseMegaMenu(item.label);
                          }
                        }}
                      >
                        <div className="flex min-h-[calc((100dvh-var(--hod-site-header-height,131px))*0.8)] w-full px-[56px] py-[44px]">
                          <div
                            className="grid w-full items-start gap-x-10"
                            style={{
                              gridTemplateColumns: item.mega.featuredImage?.imageUrl
                                ? `minmax(0, 1fr) minmax(560px, 640px)`
                                : `minmax(0, 1fr)`,
                            }}
                          >
                            <div data-mega-content className="grid max-w-[840px] grid-cols-[repeat(4,minmax(140px,max-content))] justify-start gap-x-8 gap-y-8">
                              {item.mega.sections.map((section, idx) => (
                                <div
                                  key={`${item.label}-${section.title}-${idx}`}
                                  className={`min-w-[150px] ${idx === 3 ? 'lg:border-l lg:border-black/15 lg:pl-10' : ''}`}
                                >
                                  <MegaSection section={section} onNavigate={closeMegaMenu} onPreview={(imageUrl, imageAlt) => setActiveMegaPreview({ itemLabel: item.label, imageUrl, imageAlt })} />
                                </div>
                              ))}
                            </div>
                            {item.mega.featuredImage?.imageUrl ? (
                              <div data-mega-content className="flex justify-self-end overflow-hidden bg-[#F7F8FA]">
                                <div className="h-[430px] w-[300px] max-w-[21vw] overflow-hidden">
                                  <img src={item.mega.featuredImage.imageUrl} alt={item.mega.featuredImage.imageAlt || item.label} className="h-full w-full object-cover" />
                                </div>
                                <div className="h-[430px] w-[300px] max-w-[21vw] overflow-hidden border-l border-white/20">
                                  {activeMegaPreview?.itemLabel === item.label ? <img src={activeMegaPreview.imageUrl} alt={activeMegaPreview.imageAlt} className="h-full w-full object-cover" /> : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </nav>

            <div className="relative z-[30] flex items-center justify-end gap-2.5">
              <div ref={searchRef} data-navbar-search-root className="relative">
                <div
                  className="sr-only"
                  style={{
                    borderColor: desktopHeaderBorder,
                    background: desktopUtilityBg,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => searchOpen ? closeSearch() : openSearch()}
                    aria-label="Search"
                    className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center"
                  >
                    <img src="/Navbar svgs/search-01-stroke-rounded (1).svg" alt="" aria-hidden="true" className="h-[22px] w-[22px] object-contain opacity-75 transition-opacity group-hover:opacity-100" />
                  </button>
                </div>

              </div>
              <Link
                href="/wishlist"
                aria-label="Wishlist"
                className="group relative flex h-[34px] w-[34px] items-center justify-center text-current transition-opacity duration-300 hover:opacity-70"
              >
                <img src="/Navbar svgs/heart.svg" alt="" aria-hidden="true" className="h-[22px] w-[22px] object-contain opacity-75 transition-opacity group-hover:opacity-100" />
                {wishlistCount ? <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#0A1628] px-1 text-[10px] text-white">{wishlistCount}</span> : null}
              </Link>
              <button
                type="button"
                onClick={openCart}
                aria-label="Cart"
                className="group relative flex h-[34px] w-[34px] items-center justify-center border-0 bg-transparent text-current transition-opacity duration-300 hover:opacity-70"
              >
                <img src="/Navbar svgs/handbag-simple.svg" alt="" aria-hidden="true" className="h-[22px] w-[22px] object-contain opacity-75 transition-opacity group-hover:opacity-100" />
                {cartCount ? <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#0A1628] px-1 text-[10px] text-white">{cartCount}</span> : null}
              </button>

              {customerAuthEnabled && authReady && authUser ? (
                <Link
                  href="/profile"
                  aria-label="Profile"
                  title="Profile"
                  className="inline-flex h-[34px] w-[34px] items-center justify-center text-current transition-opacity duration-300 hover:opacity-70"
                  style={{ color: desktopHeaderText }}
                >
                  <img src="/Navbar svgs/user-round-stroke-rounded.svg" alt="" aria-hidden="true" className="h-[22px] w-[22px] object-contain opacity-75 transition-opacity group-hover:opacity-100" />
                </Link>
              ) : (
                <Link
                  href="/login"
                  prefetch={false}
                  aria-label="Sign in"
                  title="Sign in"
                  className="inline-flex h-[34px] w-[34px] items-center justify-center text-current transition-opacity duration-300 hover:opacity-70"
                  style={{ color: desktopHeaderText }}
                >
                  <img src="/Navbar svgs/user-round-stroke-rounded.svg" alt="" aria-hidden="true" className="h-[22px] w-[22px] object-contain opacity-75 transition-opacity group-hover:opacity-100" />
                </Link>
              )}
            </div>
          </div>
          {searchOpen ? createPortal((
            <>
              <div
                aria-hidden="true"
                className="fixed inset-0 z-[1399] bg-black/20"
                onClick={closeSearch}
              />
              <section
                id="navbar-search-panel"
                data-navbar-search-root
                aria-label="Product search"
                className="fixed inset-x-0 top-0 z-[1400] h-dvh min-h-[100svh] overflow-y-auto bg-white sm:h-[60dvh] sm:min-h-0 lg:h-[65dvh]"
                style={{ backgroundColor: 'var(--color-brand-accent, #ffffff)', fontFamily: 'var(--font-family-secondary, Inter, sans-serif)' }}
              >
                <div className="mx-auto h-full min-h-0 max-w-[1800px] px-5 pb-10 pt-8 sm:px-8 lg:px-14 lg:pt-10">
                  <div className="flex items-center gap-3 sm:gap-5">
                    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-none border border-black/35 bg-white px-5 focus-within:ring-1 focus-within:ring-black/45 sm:px-6" style={{ backgroundColor: 'var(--color-brand-secondary, #F9F9F9)' }}>
                      <img src="/Navbar svgs/search-01-stroke-rounded (1).svg" alt="" aria-hidden="true" className="h-[22px] w-[22px] shrink-0 object-contain opacity-80" />
                      <input
                        ref={searchInputRef}
                        autoFocus
                        value={searchQuery}
                        onChange={(event) => { setSearchQuery(event.target.value); setSubmittedSearchQuery(''); setActiveSearchIndex(-1); }}
                        onKeyDown={handleSearchKeyDown}
                        role="combobox"
                        aria-label="Search products"
                        aria-autocomplete="list"
                        aria-expanded={isShowingTextSuggestions ? textSearchSuggestions.length > 0 : searchLoadState === 'ready' && displayedSearchItems.length > 0}
                        aria-controls={isShowingTextSuggestions ? 'navbar-search-suggestions' : searchLoadState === 'ready' ? 'navbar-search-results' : undefined}
                        aria-activedescendant={isShowingTextSuggestions && textSearchSuggestions[activeSearchIndex] ? `navbar-search-suggestion-${activeSearchIndex}` : displayedSearchItems[activeSearchIndex] ? `navbar-search-option-${activeSearchIndex}` : undefined}
                        placeholder="Search jewelry, settings, diamonds..."
                        className="h-12 min-w-0 flex-1 border-0 bg-transparent text-[16px] text-[var(--color-brand-primary)] outline-none placeholder:text-black/55 sm:h-14"
                      />
                      {searchQuery ? <button type="button" onClick={() => { setSearchQuery(''); setSubmittedSearchQuery(''); setActiveSearchIndex(-1); searchInputRef.current?.focus(); }} aria-label="Clear search" className="shrink-0 text-xl text-black/55 hover:text-black">×</button> : null}
                    </div>
                    <button
                      type="button"
                      onClick={closeSearch}
                      aria-label="Back to browsing"
                      className="inline-flex h-11 shrink-0 items-center gap-1.5 px-1 text-[12px] font-medium text-[var(--color-brand-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 lg:hidden"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M15 4L7 12L15 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Back</span>
                    </button>
                    <button type="button" onClick={closeSearch} className="hidden shrink-0 text-[13px] text-[var(--color-brand-primary)] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 lg:inline-flex">Cancel</button>
                  </div>
                  <div className="mt-[var(--space-4)] flex items-center justify-between border-b border-black/10 pb-[var(--space-3)] text-[10px] font-semibold uppercase tracking-[0.18em] text-black/70 sm:text-[11px]">
                    <span>{isShowingTextSuggestions ? 'Top suggestions' : submittedSearchQuery.trim() ? 'Products' : 'Explore jewelry'}</span>
                    {isShowingTextSuggestions ? <span>{textSearchSuggestions.length} suggestions</span> : searchLoadState === 'ready' && filteredSearchItems.length ? <span>{filteredSearchItems.length} {submittedSearchQuery.trim() ? 'results' : 'suggestions'}</span> : null}
                  </div>
                  <span className="sr-only" aria-live="polite">{isShowingTextSuggestions ? `${textSearchSuggestions.length} search suggestions available.` : searchLoadState === 'loading' ? 'Loading products.' : searchLoadState === 'error' ? 'Unable to load products.' : isSearchFallback ? `No exact matches. ${displayedSearchItems.length} popular pieces shown.` : `${filteredSearchItems.length} products shown.`}</span>
                  {isShowingTextSuggestions ? (
                    textSearchSuggestions.length ? (
                      <div id="navbar-search-suggestions" role="listbox" aria-label="Top search suggestions" className="py-5 sm:py-6">
                        {textSearchSuggestions.map((suggestion, index) => (
                          <button
                            key={suggestion}
                            ref={(node) => { searchOptionRefs.current[index] = node; }}
                            id={`navbar-search-suggestion-${index}`}
                            type="button"
                            role="option"
                            aria-selected={activeSearchIndex === index}
                            onMouseEnter={() => setActiveSearchIndex(index)}
                            onClick={() => submitSearch(suggestion)}
                            className="block w-full py-2.5 text-left text-[15px] font-medium leading-6 text-[#383846] outline-none transition-colors hover:text-[#8b6a3d] focus-visible:text-[#8b6a3d] sm:py-3 sm:text-[16px]"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    ) : <div className="py-[var(--space-6)] text-sm text-black/70">{searchQuery.trim().length >= 2 ? `Searching for “${searchQuery.trim()}”…` : `Press Enter to search for “${searchQuery.trim()}”.`}</div>
                  ) : searchLoadState === 'loading' ? (
                    <div aria-hidden="true" className="grid grid-cols-3 gap-x-3 gap-y-[var(--space-5)] py-[var(--space-5)] sm:grid-cols-4 sm:gap-x-5 lg:grid-cols-8">
                      {Array.from({ length: 8 }, (_, index) => (
                        <div key={index} className="min-w-0 text-center">
                          <span className="mx-auto block aspect-square w-full max-w-[112px] animate-pulse rounded-full bg-black/[0.06]" />
                          <span className="mx-auto mt-3 block h-3 w-3/4 animate-pulse rounded bg-black/[0.06]" />
                        </div>
                      ))}
                    </div>
                  ) : searchLoadState === 'error' ? (
                    <div className="py-[var(--space-6)] text-sm text-black/70">Product results are unavailable. Please try your search again.</div>
                  ) : displayedSearchItems.length ? (
                    <>
                    {isSearchFallback ? <p className="pt-[var(--space-5)] text-sm text-black/70">No exact matches for “{submittedSearchQuery.trim()}”. You might like these pieces:</p> : null}
                    <div id="navbar-search-results" role="listbox" aria-label={isSearchFallback ? 'Popular pieces' : 'Product search results'} className="grid grid-cols-3 gap-x-3 gap-y-[var(--space-5)] py-[var(--space-5)] sm:grid-cols-4 sm:gap-x-5 lg:grid-cols-8">
                      {displayedSearchItems.map((item, index) => (
                        <Link key={item.dbId || item.slug} ref={(node) => { searchOptionRefs.current[index] = node; }} id={`navbar-search-option-${index}`} role="option" aria-selected={activeSearchIndex === index} href={`/shop/${item.slug}`} onMouseEnter={() => setActiveSearchIndex(index)} onClick={closeSearch} className="group min-w-0 rounded-sm text-center outline-none focus-visible:ring-2 focus-visible:ring-black/70">
                          <span className="relative mx-auto flex aspect-square w-full max-w-[112px] items-center justify-center overflow-hidden rounded-full border border-black/5 bg-[var(--color-brand-secondary,#F9F9F9)] text-[32px] text-black/15 transition-transform duration-200 group-hover:scale-[1.04]">◇{item.imageUrl ? <img src={item.imageUrl} alt="" loading={index < 3 ? 'eager' : 'lazy'} fetchPriority={index < 3 ? 'high' : 'auto'} decoding="async" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 h-full w-full object-cover" /> : null}</span>
                          <span className="mt-3 block truncate text-[11px] font-medium text-[var(--color-brand-primary)] sm:text-[12px]" title={item.name}>{item.name}</span>
                          {item.priceFrom > 0 ? <span className="mt-1 block text-[11px] text-black/70 sm:text-[12px]">{formatPrice(item.priceFrom)}</span> : null}
                        </Link>
                      ))}
                    </div>
                    </>
                  ) : searchLoadState === 'ready' ? (
                    <div id="navbar-search-results" role="listbox" aria-label="Product search results" className="py-[var(--space-6)] text-sm text-black/70">{submittedSearchQuery.trim() ? 'No products match your search. Try another term.' : 'No products are available yet.'}</div>
                  ) : null}
                </div>
              </section>
            </>
          ), document.body) : null}
        </div>
      </header>

      <div
        onClick={closeMenu}
        aria-hidden="true"
        className="fixed inset-0 z-[998] transition-[opacity,visibility] duration-400"
        style={{
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: menuOpen ? 'blur(4px)' : 'none',
          opacity: menuOpen ? 1 : 0,
          visibility: menuOpen ? 'visible' : 'hidden',
        }}
      />

      <div
        className="fixed left-0 right-0 top-0 z-[999] h-screen w-full overflow-hidden border-b border-black/[0.06] bg-white"
        style={{
          transform: menuOpen ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.7s cubic-bezier(0.77,0,0.18,1)',
          fontFamily: 'var(--font-family-secondary, Arial, sans-serif)',
        }}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        <div
          className="flex h-full w-[200%] transition-transform duration-[600ms] ease-[cubic-bezier(0.77,0,0.18,1)] motion-reduce:transition-none"
          style={{ transform: mobileOpenItem ? 'translateX(-50%)' : 'translateX(0)' }}
        >
          <div className="h-full w-1/2 shrink-0 overflow-y-auto px-6 pb-10 pt-[110px] sm:px-8">
            <button
              type="button"
              onClick={() => {
                closeMenu();
                openSearch();
              }}
              className="mb-2 flex w-full items-center gap-3 border-b border-black/10 py-4 text-left text-[12px] font-medium uppercase tracking-[0.18em] text-[var(--color-brand-primary)]"
            >
              <img src="/Navbar svgs/search-01-stroke-rounded (1).svg" alt="" aria-hidden="true" className="h-[22px] w-[22px] object-contain opacity-80" />
              Search
            </button>

            <SmartNavLink href="/" onClick={closeMenu} className="flex min-h-[58px] items-center justify-between border-b border-black/[0.06] py-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#0A1628] no-underline">
              Home
            </SmartNavLink>

            {navItems.map((item) => {
              const hasMega = item.navigationType !== 'direct_link' && Boolean(item.mega?.sections?.length);
              if (!hasMega) {
                return (
                  <SmartNavLink key={item.label} href={item.href ?? '#'} onClick={closeMenu} className="flex min-h-[58px] items-center justify-between border-b border-black/[0.06] py-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#0A1628] no-underline">
                    {item.label}
                  </SmartNavLink>
                );
              }

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setMobileOpenItem(item.label);
                    setMobileOpenSection(item.mega?.sections?.[0]?.id ?? null);
                  }}
                  className="flex min-h-[58px] w-full items-center justify-between border-b border-black/[0.06] py-4 text-left text-[13px] font-semibold uppercase tracking-[0.16em] text-[#0A1628]"
                  aria-label={'Open ' + item.label}
                >
                  <span>{item.label}</span>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M7 4L13 10L7 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              );
            })}

            {[
              { label: 'Wishlist', href: '/wishlist' },
              { label: 'About Us', href: '/about' },
              { label: 'Contact Us', href: '/contact' },
            ].map((item) => (
              <SmartNavLink key={item.label} href={item.href} onClick={closeMenu} className="flex min-h-[58px] items-center justify-between border-b border-black/[0.06] py-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#0A1628] no-underline">
                {item.label}
              </SmartNavLink>
            ))}
            <button
              type="button"
              onClick={() => {
                closeMenu();
                openCart();
              }}
              className="flex min-h-[58px] w-full items-center justify-between border-0 border-b border-black/[0.06] bg-transparent py-4 text-left text-[13px] font-semibold uppercase tracking-[0.16em] text-[#0A1628]"
            >
              Cart
            </button>

            <Link
              href={customerAuthEnabled && authReady && authUser ? '/profile' : '/login'}
              prefetch={false}
              onClick={closeMenu}
              className="flex min-h-[58px] items-center gap-3 border-b border-black/[0.06] py-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#0A1628] no-underline"
            >
              <img src="/Navbar svgs/user-round-stroke-rounded.svg" alt="" aria-hidden="true" className="h-6 w-6 object-contain opacity-80" />
              <span>Profile</span>
            </Link>

            {customerAuthEnabled && authReady && authUser ? (
              <button type="button" onClick={handleSignOut} className="flex min-h-[58px] w-full items-center border-b border-black/[0.06] py-4 text-left text-[12px] font-medium uppercase tracking-[0.16em] text-[#0A1628]">
                Sign Out
              </button>
            ) : null}
          </div>

          <div className="h-full w-1/2 shrink-0 overflow-y-auto px-6 pb-10 pt-[102px] sm:px-8">
            <div className="relative flex min-h-[58px] items-center justify-center border-b border-black/10">
              <button
                type="button"
                onClick={() => {
                  setMobileOpenItem(null);
                  setMobileOpenSection(null);
                }}
                className="absolute left-0 grid h-11 w-11 place-items-center text-[#0A1628]"
                aria-label="Back to main menu"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M15 4L7 12L15 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <h2 className="px-12 text-center text-[15px] font-semibold uppercase tracking-[0.14em] text-[#0A1628]">
                {mobileActiveItem?.label}
              </h2>
            </div>

            {mobileActiveItem?.href ? (
              <SmartNavLink href={mobileActiveItem.href} onClick={closeMenu} className="flex min-h-[56px] items-center border-b border-black/[0.06] py-4 text-[12px] font-semibold uppercase tracking-[0.15em] text-[#0A1628] no-underline">
                Shop All
              </SmartNavLink>
            ) : null}

            {mobileActiveItem?.mega?.sections.map((section) => {
              const entries = getMobileSectionEntries(section);
              if (!entries.length) return null;
              const isExpanded = mobileOpenSection === section.id;

              return (
                <section key={section.id} className="border-b border-black/[0.08]">
                  <button
                    type="button"
                    onClick={() => setMobileOpenSection(isExpanded ? null : section.id)}
                    className="flex min-h-[62px] w-full items-center justify-between py-4 text-left text-[13px] font-semibold uppercase tracking-[0.14em] text-[#0A1628]"
                    aria-expanded={isExpanded}
                  >
                    <span>{section.title}</span>
                    <svg width="19" height="19" viewBox="0 0 19 19" fill="none" aria-hidden="true" className="transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      <path d="M4 7L9.5 12L15 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <div className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none" style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}>
                    <div className="overflow-hidden">
                      <div className="pb-5">
                        {entries.map((entry) => (
                          <SmartNavLink key={section.id + '-' + entry.label + '-' + entry.href} href={entry.href} onClick={closeMenu} className="block py-3 pl-6 text-[15px] font-normal leading-[1.4] text-[#292727] no-underline transition-colors hover:text-[#8b6a3d]">
                            {entry.label}
                          </SmartNavLink>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}

            {mobileActiveItem?.mega?.featuredImage?.imageUrl ? (
              <div className="mt-7 aspect-[4/5] w-full overflow-hidden bg-[#F7F8FA]">
                <img
                  src={mobileActiveItem.mega.featuredImage.imageUrl}
                  alt={mobileActiveItem.mega.featuredImage.imageAlt || mobileActiveItem.label}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
