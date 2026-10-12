'use client';

import { useEffect, useState } from 'react';
import { fetchPublicJson } from '@/lib/client/public-json';

const fallbackWhatsappNumber = '919328536178';

function buildWhatsappHref(number: string) {
  const digits = number.replace(/[^\d]/g, '') || fallbackWhatsappNumber;
  return `https://wa.me/${digits}?text=${encodeURIComponent("Hi, I'd like to enquire about House of Diams")}`;
}

export default function FloatingWidgets() {
  const [showBackTop, setShowBackTop] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isFooterVisible, setIsFooterVisible] = useState(false);
  const [whatsappHref, setWhatsappHref] = useState(buildWhatsappHref(fallbackWhatsappNumber));

  useEffect(() => {
    const footer = document.querySelector('.site-footer');
    if (!footer) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsFooterVisible(entry.isIntersecting);
    }, { threshold: 0.05 });
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let scrollEndTimer: ReturnType<typeof setTimeout> | undefined;

    const onScroll = () => {
      setShowBackTop(window.scrollY > 400);
      setIsScrolling(true);

      if (scrollEndTimer) clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(() => setIsScrolling(false), 2000);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollEndTimer) clearTimeout(scrollEndTimer);
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadSettings = async () => {
      try {
        const { ok, payload } = await fetchPublicJson<{ item?: { whatsapp_number?: unknown } }>('/api/public/settings');
        if (!ok || ignore) return;

        const nextNumber = typeof payload?.item?.whatsapp_number === 'string'
          ? payload.item.whatsapp_number
          : fallbackWhatsappNumber;

        setWhatsappHref(buildWhatsappHref(nextNumber));
      } catch {}
    };

    void loadSettings();
    return () => {
      ignore = true;
    };
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      {/* Back to Top */}
      <button
        onClick={scrollToTop}
        aria-label="Back to top"
        style={{
          position: 'fixed',
          right: '24px',
          bottom: 'calc(90px + env(safe-area-inset-bottom))',
          width: '52px',
          height: '52px',
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 100,
          opacity: showBackTop && !isScrolling ? 1 : 0,
          visibility: showBackTop && !isScrolling ? 'visible' : 'hidden',
          pointerEvents: showBackTop && !isScrolling ? 'auto' : 'none',
          transition: 'all 0.4s',
          background: '#FFFFFF',
          color: '#000000',
          border: '1px solid rgba(0,0,0,0.18)',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.background = '#FFFFFF';
          el.style.color = '#000000';
          el.style.borderColor = '#000000';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.background = '#FFFFFF';
          el.style.color = '#000000';
          el.style.borderColor = 'rgba(0,0,0,0.18)';
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 13V1M1 7L7 1L13 7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Chat FAB */}
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us"
        style={{
          position: 'fixed',
          bottom: 'calc(24px + env(safe-area-inset-bottom))',
          right: '24px',
          width: '70px',
          height: '50px',
          borderRadius: 999,
          background: '#1d1e22',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 100,
          textDecoration: 'none',
          opacity: isScrolling || isFooterVisible ? 0 : 1,
          visibility: isScrolling || isFooterVisible ? 'hidden' : 'visible',
          pointerEvents: isScrolling || isFooterVisible ? 'none' : 'auto',
          boxShadow: '0 12px 30px rgba(0,0,0,0.28)',
          transition: 'all 0.3s',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.transform = 'scale(1.08)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
      >
        <img src="/Navbar svgs/chat-circle.svg" alt="" aria-hidden="true" style={{ width: '32px', height: '32px', filter: 'invert(1)', opacity: 0.95 }} />
      </a>
    </>
  );
}
