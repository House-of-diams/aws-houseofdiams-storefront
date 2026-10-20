import type { NextConfig } from "next";

const mediaCdnBaseUrl = process.env.NEXT_PUBLIC_MEDIA_CDN_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
// Admin CMS, category and navbar uploads are stored on the content CDN.
const contentCdnBaseUrl = (process.env.NEXT_PUBLIC_CONTENT_CDN_BASE_URL?.trim() || 'https://content.houseofdiams.com').replace(/\/+$/, '')
const imageHosts = [...new Set([mediaCdnBaseUrl, contentCdnBaseUrl].filter(Boolean).map((url) => new URL(url).hostname))]

// CSP matters only for HTML documents; JSON API responses skip it to keep
// response headers under proxy buffer limits (HOD-074).
const contentSecurityPolicy = {
  key: 'Content-Security-Policy-Report-Only',
  value: [
    "default-src 'self'",
    // Pinterest and Google Ads tags are injected by the GTM container.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://www.googletagmanager.com https://www.google-analytics.com https://ajax.googleapis.com https://*.clarity.ms https://s.pinimg.com https://ct.pinterest.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://maps.googleapis.com https://checkout.razorpay.com https://api.razorpay.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://ajax.googleapis.com https://*.clarity.ms https://www.google.com https://*.doubleclick.net https://ct.pinterest.com",
    "media-src 'self' data: blob: https:",
    "frame-src 'self' https://checkout.razorpay.com https://www.googletagmanager.com https://www.instagram.com https://ct.pinterest.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    // upgrade-insecure-requests is ignored in a report-only policy and only logs console errors.
    "report-uri /api/csp-report",
  ].join('; '),
}

const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
]

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  turbopack: {},
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: /(^|[\\/])(node_modules|\.git|\.next|System Volume Information|\$RECYCLE\.BIN)([\\/]|$)/,
      }
    }

    return config
  },
  images: {
    remotePatterns: imageHosts.map((hostname) => ({ protocol: 'https' as const, hostname })),
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/((?!api/).*)',
        headers: [contentSecurityPolicy],
      },
      {
        source: '/.well-known/apple-developer-merchantid-domain-association',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/plain; charset=utf-8',
          },
        ],
      },
    ];
  },
};

export default nextConfig;


