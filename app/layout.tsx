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
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import GoogleTagManager from "@/components/analytics/GoogleTagManager";
import MaintenanceScreen from "@/components/layout/MaintenanceScreen";
import { getMaintenanceMode } from "@/lib/maintenance";
import { ToastProvider } from "@/components/home/Toast";
import { cookies, headers } from "next/headers";
import { currencyForCountry, normalizeCountryCode } from "@/lib/country-currency";
import { getNavbarRenderItems } from "@/lib/navbar-server";
import { loadPublicAnnouncementBar } from "@/lib/announcement-bar";

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

export const metadata: Metadata = {
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [maintenanceMode, navItems, announcement, requestHeaders, requestCookies] = await Promise.all([
    getMaintenanceMode(),
    getNavbarRenderItems().catch(() => []),
    // Real announcement text on the very first paint (null = fall back to the client fetch).
    loadPublicAnnouncementBar().catch(() => null),
    headers(),
    cookies(),
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
        <GoogleTagManager />
        <JsonLd data={createOrganizationSchema()} />
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        {maintenanceMode.enabled ? (
          <MaintenanceScreen message={maintenanceMode.message} />
        ) : (
          <WishlistProvider>
            <CurrencyProvider initialDetectedCurrency={initialDetectedCurrency}>
              <ContactDrawerProvider>
                <CartProvider>
                  <ToastProvider>
                    <SiteChrome initialNavItems={navItems} initialAnnouncement={announcement} customerAuthEnabled={process.env.HOD_CUSTOMER_AUTH_ENABLED === 'true'}>{children}</SiteChrome>
                  </ToastProvider>
                </CartProvider>
              </ContactDrawerProvider>
            </CurrencyProvider>
          </WishlistProvider>
        )}
      </body>
    </html>
  );
}
