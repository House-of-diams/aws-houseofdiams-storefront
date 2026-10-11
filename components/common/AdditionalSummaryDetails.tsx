'use client'

import { useEffect, useRef, useState } from 'react'
import { CirclePlay, Gift, PackageCheck, RefreshCcw, X } from 'lucide-react'

type SummaryPointer = {
  id: string
  icon_url: string | null
  pointer_text: string
  video_url: string | null
  video_link_text: string | null
}

type VideoSource = {
  url: string
  title: string
  kind: 'embed' | 'file'
}

function getVideoSource(url: string, title: string): VideoSource | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    const pathname = parsed.pathname
    const directVideo = /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(pathname)

    if (directVideo) return { url, title, kind: 'file' }

    if (host === 'youtu.be') {
      const videoId = pathname.split('/').filter(Boolean)[0]
      return videoId ? { url: `https://www.youtube-nocookie.com/embed/${videoId}`, title, kind: 'embed' } : null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const videoId = pathname.startsWith('/embed/') ? pathname.split('/')[2] : parsed.searchParams.get('v')
      return videoId ? { url: `https://www.youtube-nocookie.com/embed/${videoId}`, title, kind: 'embed' } : null
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const videoId = pathname.match(/\d+/)?.[0]
      return videoId ? { url: `https://player.vimeo.com/video/${videoId}`, title, kind: 'embed' } : null
    }

    if (host === 'loom.com' || host === 'www.loom.com') {
      const videoId = pathname.split('/').filter(Boolean).at(-1)
      return videoId ? { url: `https://www.loom.com/embed/${videoId}`, title, kind: 'embed' } : null
    }
  } catch {}

  return null
}

export default function AdditionalSummaryDetails() {
  const [summary, setSummary] = useState<{ heading: string; pointers: SummaryPointer[] } | null>(null)
  const [activeVideo, setActiveVideo] = useState<VideoSource | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const response = await fetch('/api/public/additional-summary-details')
      const payload = await response.json().catch(() => null)
      if (!cancelled && response.ok && payload?.summary?.pointers?.length) setSummary(payload.summary as { heading: string; pointers: SummaryPointer[] })
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!activeVideo) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveVideo(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeVideo])

  if (!summary) return null

  return <>
    <section aria-label={summary.heading} style={{ fontFamily: 'var(--font-inter), Inter, Arial, sans-serif' }} className="-mt-px w-full border border-black/10 bg-white px-5 py-5 text-black">
      <div className="mb-5 border-b border-black/10 pb-4">
        <p className="font-[family-name:var(--font-family-inter)] text-[14px] font-medium text-black">Your order includes:</p>
        <div className="mt-3 space-y-2.5">
          <div className="flex items-center gap-2.5 font-[family-name:var(--font-family-inter)] text-[13px] text-black"><PackageCheck size={17} strokeWidth={1.8} className="shrink-0 text-black" /><span>Complimentary insured shipping</span></div>
          <div className="flex items-center gap-2.5 font-[family-name:var(--font-family-inter)] text-[13px] text-black"><RefreshCcw size={17} strokeWidth={1.8} className="shrink-0 text-black" /><span>Complimentary 15-day returns</span></div>
          <div className="flex items-center gap-2.5 font-[family-name:var(--font-family-inter)] text-[13px] text-black"><Gift size={17} strokeWidth={1.8} className="shrink-0 text-black" /><span>Signature gift packaging</span></div>
        </div>
      </div>
      <p role="heading" aria-level={2} className="font-[family-name:var(--font-family-inter)] text-[14px] font-medium leading-6 text-black">{summary.heading}</p>
      <ul className="mt-4 space-y-4">
        {summary.pointers.map((point) => <li key={point.id} className="flex items-start gap-2.5 text-[14px] font-medium leading-5 text-black">
          {point.icon_url ? <img src={point.icon_url} alt="" className="mt-0.5 h-[17px] w-[17px] shrink-0 object-contain" /> : <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-black" />}
          <div className="font-[family-name:var(--font-family-inter)] text-[14px] font-medium leading-5 text-black"><span>{point.pointer_text}</span>{point.video_url && <div>{(() => {
            const title = point.video_link_text || 'Watch video'
            const video = getVideoSource(point.video_url, title)
            const actionClass = "mt-1 inline-flex items-center gap-1.5 font-[family-name:var(--font-family-inter)] text-[13px] font-semibold text-blue-700 no-underline hover:text-blue-800"
            return video ? <button type="button" onClick={() => setActiveVideo(video)} className={`${actionClass} border-0 bg-transparent p-0 text-left cursor-pointer`}><CirclePlay size={17} strokeWidth={1.8} aria-hidden="true" />{title}</button> : <a href={point.video_url} target="_blank" rel="noopener noreferrer" className={actionClass}><CirclePlay size={17} strokeWidth={1.8} aria-hidden="true" />{title}<span className="sr-only"> (opens in a new tab)</span></a>
          })()}</div>}</div>
        </li>)}
      </ul>
    </section>
    {activeVideo ? <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveVideo(null) }}>
      <div role="dialog" aria-modal="true" aria-label={activeVideo.title} className="relative w-full max-w-4xl border border-black/20 bg-white p-3 shadow-2xl sm:p-4">
        <button ref={closeButtonRef} type="button" onClick={() => setActiveVideo(null)} className="ml-auto flex h-10 items-center gap-1.5 border border-black bg-white px-3 font-[family-name:var(--font-family-inter)] text-[13px] font-medium text-black transition hover:bg-black hover:text-white" aria-label="Close video"><X size={17} aria-hidden="true" />Close</button>
        <div className="mt-3 aspect-video w-full bg-black">
          {activeVideo.kind === 'file' ? <video className="h-full w-full" controls autoPlay playsInline src={activeVideo.url}>Your browser does not support embedded video.</video> : <iframe className="h-full w-full" src={activeVideo.url} title={activeVideo.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />}
        </div>
      </div>
    </div> : null}
  </>
}
