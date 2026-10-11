import type { NextConfig } from "next";

const mediaCdnBaseUrl = process.env.NEXT_PUBLIC_MEDIA_CDN_BASE_URL?.trim().replace(/\/+$/, '') ?? ''

const securityHeaders = [
  {
    key: 'Content-Security-Policy-Report-Only',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://www.googletagmanager.com https://www.google-analytics.com https://ajax.googleapis.com https://*.clarity.ms",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://maps.googleapis.com https://checkout.razorpay.com https://api.razorpay.com https://www.google-analytics.com https://www.googletagmanager.com https://ajax.googleapis.com https://*.clarity.ms",
      "media-src 'self' data: blob: https:",
      "frame-src 'self' https://checkout.razorpay.com https://www.googletagmanager.com https://www.instagram.com",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
      "report-uri /api/csp-report",
    ].join('; '),
  },
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
    remotePatterns: [
      ...(mediaCdnBaseUrl ? [{ protocol: 'https' as const, hostname: new URL(mediaCdnBaseUrl).hostname }] : []),
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
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
      {
        source: '/animation%20images/frames/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/frames/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;


