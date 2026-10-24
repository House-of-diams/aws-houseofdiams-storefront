'use client'

import { ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { HomeInstagramReelsData } from '@/lib/home-data'

function toEmbedUrl(url: string) {
  const normalized = url.endsWith('/') ? url : `${url}/`
  return `${normalized}embed/`
}

const cardClass = 'group relative h-[400px] w-[255px] shrink-0 overflow-hidden bg-black sm:h-[440px] sm:w-[280px]'

/** An uploaded reel: plays muted and looping while it is on screen, with a button to turn the sound on. */
function VideoReelCard({ item, videoUrl }: { item: HomeInstagramReelsData['items'][number]; videoUrl: string }) {
  const title = item.title || 'House of Diams reel'
  const cardRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    const card = cardRef.current
    const video = videoRef.current
    if (!card || !video) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void video.play().catch(() => undefined)
      else video.pause()
    }, { threshold: 0.4 })
    observer.observe(card)
    return () => observer.disconnect()
  }, [])

  return (
    <article ref={cardRef} className={cardClass}>
      <video
        ref={videoRef}
        src={videoUrl}
        poster={item.coverImageUrl ?? undefined}
        muted={muted}
        loop
        playsInline
        preload="none"
        aria-label={title}
        className="absolute inset-0 size-full object-cover"
      />
      <button
        type="button"
        onClick={() => setMuted((current) => !current)}
        aria-label={muted ? `Turn sound on for ${title}` : `Turn sound off for ${title}`}
        aria-pressed={!muted}
        className="absolute bottom-3 right-3 z-10 grid size-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {muted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
      </button>
    </article>
  )
}

function ReelCard({ item }: { item: HomeInstagramReelsData['items'][number] }) {
  const title = item.title || 'House of Diams reel'
  if (item.videoUrl) return <VideoReelCard item={item} videoUrl={item.videoUrl} />
  if (!item.instagramUrl) return null

  return (
    <article className={cardClass}>
      <iframe
        title={`Instagram: ${title}`}
        src={toEmbedUrl(item.instagramUrl)}
        loading="lazy"
        allow="autoplay; encrypted-media; picture-in-picture"
        scrolling="no"
        className="instagram-reel-frame absolute left-1/2 top-0 border-0 bg-black"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-black sm:hidden" />
    </article>
  )
}

export default function InstagramReels({ data }: { data: HomeInstagramReelsData }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [hasOverflow, setHasOverflow] = useState(false)
  const [canGoPrevious, setCanGoPrevious] = useState(false)
  const [canGoNext, setCanGoNext] = useState(false)

  const updateControls = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth)
    setHasOverflow(maxScrollLeft > 1)
    setCanGoPrevious(scroller.scrollLeft > 1)
    setCanGoNext(scroller.scrollLeft < maxScrollLeft - 1)
  }, [])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    updateControls()
    const resizeObserver = new ResizeObserver(updateControls)
    resizeObserver.observe(scroller)
    window.addEventListener('resize', updateControls)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateControls)
    }
  }, [data.items.length, updateControls])

  const scrollReels = (direction: -1 | 1) => {
    const scroller = scrollerRef.current
    if (!scroller) return

    scroller.scrollBy({
      left: direction * Math.max(240, Math.floor(scroller.clientWidth * 0.8)),
      behavior: 'smooth',
    })
  }

  if (!data.isEnabled || data.items.length === 0) return null

  return (
    <section aria-labelledby="instagram-reels-heading" className="section-rhythm overflow-hidden bg-white px-[var(--space-2)] text-[#111b2b] sm:px-[var(--space-3)] lg:px-[var(--space-4)]">
      <div className="mb-[var(--space-section-block)] flex items-end justify-between gap-4 max-md:justify-center">
        <h2 id="instagram-reels-heading" className="section-title font-primary-display font-light leading-[1.08] tracking-[0.01em] text-[#0A1628] max-md:text-[28px]" style={{ fontSize: 'clamp(24px, 4.5vw, 54px)', fontWeight: 400 }}>
          {data.heading || 'Instagram'}
        </h2>
        {hasOverflow ? (
          <div className="flex shrink-0 items-center gap-2" aria-label="Instagram reel navigation">
            <button type="button" onClick={() => scrollReels(-1)} disabled={!canGoPrevious} aria-label="Show previous Instagram reels" className="hidden grid size-9 place-items-center border border-black/20 bg-white text-black transition hover:border-black disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black md:grid">
              <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => scrollReels(1)} disabled={!canGoNext} aria-label="Show next Instagram reels" className="hidden grid size-9 place-items-center border border-black/20 bg-white text-black transition hover:border-black disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black md:grid">
              <ChevronRight size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      <div ref={scrollerRef} onScroll={updateControls} className="-mx-[var(--space-2)] flex gap-4 overflow-x-auto scroll-smooth px-[var(--space-2)] py-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-[var(--space-3)] sm:gap-5 sm:px-[var(--space-3)] lg:-mx-[var(--space-4)] lg:px-[var(--space-4)]">
        {data.items.map((item) => <ReelCard key={item.id} item={item} />)}
      </div>

      <style>{`.instagram-reel-frame { width: calc(100% + 96px); height: calc(100% + 180px); transform: translate(-50%, -104px); overflow: hidden; } .instagram-reel-frame::-webkit-scrollbar { display: none; }`}</style>
    </section>
  )
}
