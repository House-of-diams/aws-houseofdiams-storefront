// HOD-090: shaping of the video library and hover-view rows for the storefront. Pure functions, no database access.
export const HOVER_FRAME_COUNT = 24

type Row = Record<string, unknown>
export type LibraryVideo = { id: string; label: string; media_path: string }
export type VariantMediaItem = { id: string; type: 'image' | 'video'; url: string; altText?: string | null; sortOrder: number }

export function buildMediaExtrasIndex(extras: { library: Row[]; links: Row[]; hover: Row[] }) {
  const libraryById = new Map<string, LibraryVideo>()
  for (const entry of extras.library) {
    if (typeof entry.id === 'string' && typeof entry.media_path === 'string' && entry.media_path.trim()) {
      libraryById.set(entry.id, { id: entry.id, label: typeof entry.label === 'string' ? entry.label : '', media_path: entry.media_path.trim() })
    }
  }
  const videoByProductMetal = new Map<string, LibraryVideo>()
  for (const entry of extras.links) {
    const video = libraryById.get(String(entry.library_id))
    if (video) videoByProductMetal.set(`${entry.product_id}:${entry.metal_id}`, video)
  }
  const hoverFramesByProduct = new Map<string, string[]>()
  for (const entry of extras.hover) {
    const frames = Array.isArray(entry.frame_paths) ? entry.frame_paths.filter((path): path is string => typeof path === 'string' && path.length > 0) : []
    if (frames.length === HOVER_FRAME_COUNT) hoverFramesByProduct.set(String(entry.product_id), frames)
  }
  return { videoByProductMetal, hoverFramesByProduct }
}

/** A metal option keeps its own video if it has one; otherwise it gets the library video chosen for it. */
export function withLibraryVideo(mediaItems: VariantMediaItem[], video: LibraryVideo | undefined, toUrl: (path: string) => string | null | undefined): VariantMediaItem[] {
  if (!video || mediaItems.some((item) => item.type === 'video')) return mediaItems
  const url = toUrl(video.media_path) ?? video.media_path
  return url ? [...mediaItems, { id: `library-${video.id}`, type: 'video', url, altText: video.label || null, sortOrder: 9999 }] : mediaItems
}

/** Which of the 24 frames to show for a pointer position across a view of the given width. */
export function frameFromPosition(position: number, width: number, count = HOVER_FRAME_COUNT) {
  if (!(width > 0) || count < 1) return 0
  const ratio = Math.min(1, Math.max(0, position / width))
  return Math.min(count - 1, Math.round(ratio * (count - 1)))
}
