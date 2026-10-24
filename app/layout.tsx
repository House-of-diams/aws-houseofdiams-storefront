import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, Manrope, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import SiteChrome from "@/components/layout/SiteChrome";
import {
  cinzelFont,
  houseOfDiamsWordmarkFont,
  interFont,
  loaderWordmarkFont,
  montserratFont,
  marcellusFont,
} from "@/app/fonts";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { CartProvider } from "@/lib/hooks/useCart";
import { ContactDrawerProvider } from "@/lib/hooks/useContactDrawer";
import { WishlistProvider } from "@/lib/hooks/useWishlistStore";
import { getSiteUrl } from "@/lib/site-url";
import JsonLd from "@/components/seo/JsonLd";
import { createOrganizationSchema } from "@/lib/structured-data";
import ConsentedAnalytics from "@/components/consent/ConsentedAnalytics";
import CookieBanner from "@/components/consent/CookieBanner";
import MaintenanceScreen from "@/components/layout/MaintenanceScreen";
import { getMaintenanceMode } from "@/lib/maintenance";
import { ToastProvider } from "@/components/home/Toast";
import { cookies, headers } from "next/headers";
import { currencyForCountry, normalizeCountryCode } from "@/lib/country-currency";
import { getNavbarRenderItems } from "@/lib/navbar-server";
import { loadPublicAnnouncementBar } from "@/lib/announcement-bar";
import { loadPublicContactInfo } from "@/lib/contact-info-public";
import { getSiteSeoSettings } from "@/lib/page-seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  preload: false,
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  preload: false,
});

const baseMetadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "House of Diams",
    template: "%s | House of Diams",
  },
  description: "Luxury diamond jewellery, crafted in Surat, India.",
  icons: {
    icon: "/favicon.ico",
  },
  verification: {
    other: {
      'msvalidate.01': '4B163F684E5979CF3BB4A6CE96FA16F8',
      'p:domain_verify': '0dc26778b2974a2e369a1b6cbce39fa7',
    },
  },
};

// Search Console / Bing verification codes can be set in the admin (Site settings).
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSeoSettings();
  const google = settings?.google_site_verification?.trim();
  const bing = settings?.bing_site_verification?.trim();
  return {
    ...baseMetadata,
    verification: {
      ...(google ? { google } : {}),
      other: {
        ...baseMetadata.verification?.other,
        ...(bing ? { 'msvalidate.01': bing } : {}),
      },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [maintenanceMode, navItems, announcement, contactRows, requestHeaders, requestCookies, siteSeoSettings] = await Promise.all([
    getMaintenanceMode(),
    getNavbarRenderItems().catch(() => []),
    // Real announcement text on the very first paint (null = fall back to the client fetch).
    loadPublicAnnouncementBar().catch(() => null),
    // Real footer contact details on the first paint (null = fall back to the client fetch).
    loadPublicContactInfo().catch(() => null),
    headers(),
    cookies(),
    getSiteSeoSettings(),
  ])
  const detectedCountry = normalizeCountryCode(
    requestHeaders.get('cloudfront-viewer-country') || requestCookies.get('detected_country')?.value
  )
  const initialDetectedCurrency = detectedCountry
    ? currencyForCountry(detectedCountry)
    : requestCookies.get('detected_currency')?.value || 'USD'

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${plusJakartaSans.variable} ${manrope.variable} ${cinzelFont.variable} ${interFont.variable} ${montserratFont.variable} ${marcellusFont.variable} ${houseOfDiamsWordmarkFont.variable} ${loaderWordmarkFont.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <JsonLd data={createOrganizationSchema(siteSeoSettings)} />
        <Suspense fallback={null}>
          <ConsentedAnalytics />
        </Suspense>
        {maintenanceMode.enabled ? (
          <MaintenanceScreen message={maintenanceMode.message} />
        ) : (
          <WishlistProvider>
            <CurrencyProvider initialDetectedCurrency={initialDetectedCurrency}>
              <ContactDrawerProvider>
                <CartProvider>
                  <ToastProvider>
                    <SiteChrome initialNavItems={navItems} initialAnnouncement={announcement} initialContactRows={contactRows} customerAuthEnabled={process.env.HOD_CUSTOMER_AUTH_ENABLED === 'true'}>{children}</SiteChrome>
                  </ToastProvider>
                </CartProvider>
              </ContactDrawerProvider>
            </CurrencyProvider>
          </WishlistProvider>
        )}
        <CookieBanner />
      </body>
    </html>
  );
}
