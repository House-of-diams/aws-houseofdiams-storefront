/** Only an https video file is played; anything else stored in the reel's video column is ignored rather than put in a page. */
export function reelVideoUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && !url.username && !url.password && /\.(mp4|mov|webm)$/i.test(url.pathname) ? url.href : null
  } catch {
    return null
  }
}
