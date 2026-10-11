// Public historical origins used only to translate stored media URLs to CDN keys.
// No credentials or network access; keep until stored rows no longer contain these URLs.
export const legacyMediaOrigins = [
  {
    "host": "ztvqqgisjlswztrcosgk.supabase.co",
    "type": "public-storage"
  },
  {
    "host": "pub-0ea48ff8bc25421e949ac1de2d305b1a.r2.dev",
    "type": "object-storage"
  }
] as const
