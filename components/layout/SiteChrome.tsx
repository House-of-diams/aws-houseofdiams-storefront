'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import NextTopLoader from 'nextjs-toploader';
import Navbar from '@/components/common/Navbar';
import CartDrawer from '@/components/commerce/CartDrawer';
import ContactDrawer from '@/components/contact/ContactDrawer';
import ViewportDeferred from '@/components/home/ViewportDeferred';
import type { NavbarRenderItem } from '@/lib/navbar';
import DataSourceStatus from '@/components/layout/DataSourceStatus';

const Footer = dynamic(() => import('@/components/common/Footer'), { loading: () => null });
const AtYourService = dynamic(() => import('@/components/home/AtYourService'), { loading: () => null });
const SelectedCouponOffer = dynamic(() => import('@/components/home/SelectedCouponOffer'), { loading: () => null });
const FloatingWidgets = dynamic(() => import('@/components/home/FloatingWidgets'), { loading: () => null });
const PromotionPopup = dynamic(() => import('@/components/layout/PromotionPopup'), { loading: () => null });

const AUTH_ROUTES = new Set(['/login', '/signup']);

export default function SiteChrome({ children, initialNavItems, customerAuthEnabled = false }: { children: ReactNode; initialNavItems: NavbarRenderItem[]; customerAuthEnabled?: boolean }) {
  const pathname = usePathname();
  const navItems = initialNavItems;
  const [showNonCriticalChrome, setShowNonCriticalChrome] = useState(false);
  const isMinimalChromeRoute = pathname
    ? AUTH_ROUTES.has(pathname) || pathname === '/checkout'
    : false;


  useEffect(() => {
    const reveal = () => setShowNonCriticalChrome(true);
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(reveal, { timeout: 2000 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }
    const timeoutId = window.setTimeout(reveal, 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <>
      <NextTopLoader
        color="#B8924A"
        height={3}
        showSpinner={false}
        crawl
        speed={240}
        crawlSpeed={180}
        initialPosition={0.12}
        shadow="0 0 10px rgba(184, 146, 74, 0.45), 0 0 4px rgba(184, 146, 74, 0.3)"
        zIndex={12000}
      />
      <DataSourceStatus />
      {isMinimalChromeRoute ? (
        <main className="flex-1">{children}</main>
      ) : (
        <>
          <div id="site-navbar-shell">
            <Navbar navItems={navItems} customerAuthEnabled={customerAuthEnabled} />
          </div>
          <CartDrawer />
          <ContactDrawer />
          <main className="flex-1" style={{ paddingTop: 'var(--hod-site-header-height, 118px)' }}>{children}</main>
          <ViewportDeferred minHeight={520}>
            <AtYourService />
            <SelectedCouponOffer />
          </ViewportDeferred>
          <div id="site-footer-shell">
            <Footer navItems={navItems} />
          </div>
          <PromotionPopup />
          {showNonCriticalChrome ? (
            <div>
              <FloatingWidgets />
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
