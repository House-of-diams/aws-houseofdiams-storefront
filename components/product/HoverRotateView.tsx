'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { frameFromPosition, HOVER_FRAME_COUNT } from '@/lib/product-media-extras';

// HOD-090: a product shown from 24 angles. Moving the mouse across the picture (or dragging a finger sideways)
// turns the piece. Only the middle frame loads up front; the rest load when the shopper first approaches or
// touches it, and every frame is a small static file served from the CDN.
const FRAME_COUNT = HOVER_FRAME_COUNT;
const MIDDLE = Math.floor(FRAME_COUNT / 2);

type Props = { frames: string[]; alt: string; className?: string };

export default function HoverRotateView({ frames, alt, className = '' }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const preloaded = useRef(false);
  const [frame, setFrame] = useState(MIDDLE);
  const usable = frames.length === FRAME_COUNT;

  const preload = useCallback(() => {
    if (preloaded.current || !usable) return;
    preloaded.current = true;
    frames.forEach((url) => { const image = new Image(); image.decoding = 'async'; image.src = url; });
  }, [frames, usable]);

  // Start loading the rest when the view scrolls near the screen and the browser is idle.
  useEffect(() => {
    const node = stage.current;
    if (!node || !usable || typeof IntersectionObserver === 'undefined') return;
    let idle: number | undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      const run = () => preload();
      idle = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(run, { timeout: 3000 }) : window.setTimeout(run, 1500);
    }, { rootMargin: '200px' });
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (idle !== undefined) { if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle); else window.clearTimeout(idle); }
    };
  }, [preload, usable]);

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = stage.current;
    if (!node) return;
    // A mouse turns the piece by hovering; a finger or pen must be pressed and dragged.
    if (event.pointerType !== 'mouse' && event.buttons === 0) return;
    const box = node.getBoundingClientRect();
    setFrame(frameFromPosition(event.clientX - box.left, box.width));
  };

  const key = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); preload(); setFrame((current) => Math.max(0, current - 1)); }
    if (event.key === 'ArrowRight') { event.preventDefault(); preload(); setFrame((current) => Math.min(FRAME_COUNT - 1, current + 1)); }
  };

  if (!usable) return null;

  return (
    <div
      ref={stage}
      role="slider"
      tabIndex={0}
      aria-label={`${alt}. Rotate the piece with the left and right arrow keys, or move across the picture.`}
      aria-valuemin={1}
      aria-valuemax={FRAME_COUNT}
      aria-valuenow={frame + 1}
      aria-valuetext={`View ${frame + 1} of ${FRAME_COUNT}`}
      onPointerEnter={preload}
      onPointerDown={(event) => { preload(); move(event); }}
      onPointerMove={move}
      onPointerLeave={(event) => { if (event.pointerType === 'mouse') setFrame(MIDDLE); }}
      onKeyDown={key}
      className={`absolute inset-0 cursor-ew-resize touch-pan-y select-none overflow-hidden bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0A1628] ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={frames[frame]} alt="" draggable={false} className="h-full w-full object-contain object-center" />
      <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0A1628]/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        360&deg; &middot; drag to rotate
      </span>
    </div>
  );
}
