// components/product/ProductGallery.tsx - House of Diams
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Film, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { GemStyle } from '@/lib/data/products';
import GemSVG from '@/components/common/GemSVG';

interface ProductGalleryProps {
  gemStyle: GemStyle;
  gemColor: string;
  dark?: boolean;
  imageUrl?: string;
  galleryUrls?: string[];
  imageAlts?: string[];
  videoUrl?: string;
  model3dUrl?: string;
}

type MediaAsset =
  | { type: 'image'; url: string; alt?: string }
  | { type: 'video'; url: string; alt?: string }
  | { type: 'model'; url: string; alt?: string };
type ImageAsset = Extract<MediaAsset, { type: 'image' }>;
type SlideAsset = Extract<MediaAsset, { type: 'image' | 'video' }>;
type ThumbnailSlot = MediaAsset | { type: 'placeholder'; key: string };

function ModelViewer({ src }: { src: string }) {
  return React.createElement('model-viewer', {
    src,
    alt: 'Interactive 3D jewellery model',
    'camera-controls': true,
    'auto-rotate': true,
    'auto-rotate-delay': '0',
    'rotation-per-second': '32deg',
    'interaction-prompt': 'none',
    'touch-action': 'pan-y',
    loading: 'lazy',
    className: 'absolute inset-0 h-full w-full',
  });
}

function ProductVideo({ src }: { src: string }) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-white">
      {!hasError ? (
        <video
          src={`${src}#t=0.1`}
          className="absolute inset-0 h-full w-full bg-white object-contain object-center"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          onError={() => setHasError(true)}
        />
      ) : null}

      {hasError ? (
        <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center text-[#0A1628]" role="status">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F2F4F7]">
            <Film className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
          </span>
          <span className="text-sm font-medium">This video could not be previewed.</span>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-semibold uppercase tracking-[0.16em] underline underline-offset-4"
          >
            Open video
          </a>
        </div>
      ) : null}
    </div>
  );
}

export default function ProductGallery({
  gemStyle,
  gemColor,
  dark = false,
  imageUrl,
  galleryUrls = [],
  imageAlts = [],
  videoUrl,
  model3dUrl,
}: ProductGalleryProps) {
  useEffect(() => {
    if (!model3dUrl || typeof document === 'undefined') return;
    if (document.querySelector('script[data-model-viewer-script="true"]')) return;

    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
    script.dataset.modelViewerScript = 'true';
    document.head.appendChild(script);
  }, [model3dUrl]);

  const assets = useMemo<MediaAsset[]>(() => {
    const imageAssets = [imageUrl, ...galleryUrls]
      .filter((url): url is string => typeof url === 'string' && url.length > 0)
      .map((url, index) => ({ type: 'image' as const, url, alt: imageAlts[index] }));

    const nonImageAssets: MediaAsset[] = [];
    if (videoUrl) nonImageAssets.push({ type: 'video', url: videoUrl });
    if (model3dUrl) nonImageAssets.push({ type: 'model', url: model3dUrl });

    return [...imageAssets, ...nonImageAssets];
  }, [imageUrl, galleryUrls, imageAlts, videoUrl, model3dUrl]);

  const imageAssets = useMemo(
    () => assets.filter((asset): asset is ImageAsset => asset.type === 'image'),
    [assets],
  );
  const slideAssets = useMemo(
    () => assets.filter((asset): asset is SlideAsset => asset.type === 'image' || asset.type === 'video'),
    [assets],
  );

  // A product video is the primary gallery asset wherever the gallery is shown.
  // Keep the remaining image and 3D assets in their supplied order.
  const desktopGridAssets = useMemo(() => {
    const video = assets.find((asset) => asset.type === 'video');
    if (!video) return assets;

    return [video, ...assets.filter((asset) => asset.type !== 'video')];
  }, [assets]);

  // On mobile, surface the video first so shoppers see it before scrolling through images.
  const mobileAssets = useMemo(() => {
    const video = assets.find((asset) => asset.type === 'video');
    if (!video) return assets;

    return [video, ...assets.filter((asset) => asset.type !== 'video')];
  }, [assets]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const visibleActiveIndex = mobileAssets.length > 0 ? Math.min(activeIndex, mobileAssets.length - 1) : 0;
  const visibleLightboxIndex = lightboxIndex !== null && slideAssets.length > 0
    ? Math.min(lightboxIndex, slideAssets.length - 1)
    : null;
  const isLightboxOpen = visibleLightboxIndex !== null;
  const activeAsset = mobileAssets[visibleActiveIndex] ?? null;
  const activeLightboxAsset = visibleLightboxIndex === null ? null : slideAssets[visibleLightboxIndex] ?? null;
  const firstMobileImageIndex = mobileAssets.findIndex((asset) => asset.type === 'image');
  const firstMobileImage = firstMobileImageIndex >= 0 ? mobileAssets[firstMobileImageIndex] : null;

  const thumbnailSlots = useMemo<ThumbnailSlot[]>(() => {
    const minSlots = 5;
    const placeholdersNeeded = Math.max(0, minSlots - mobileAssets.length);
    return [
      ...mobileAssets,
      ...Array.from({ length: placeholdersNeeded }, (_, index) => ({
        type: 'placeholder' as const,
        key: `placeholder-${index}`,
      })),
    ];
  }, [mobileAssets]);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const navigateLightbox = useCallback((direction: 1 | -1) => {
    setLightboxIndex((current) => {
      if (current === null || slideAssets.length === 0) return current;
      return (current + direction + slideAssets.length) % slideAssets.length;
    });
  }, [slideAssets.length]);

  const openLightbox = useCallback((asset: ImageAsset) => {
    const nextIndex = slideAssets.indexOf(asset);
    if (nextIndex < 0) return;

    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      returnFocusRef.current = document.activeElement;
    }
    setLightboxIndex(nextIndex);
  }, [slideAssets]);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const mainGalleryRef = useRef<HTMLDivElement>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeSettling, setIsSwipeSettling] = useState(false);
  const swipeSettleTimeoutRef = useRef<number | null>(null);
  const swipeAnimationFrameRef = useRef<number | null>(null);
  const suppressMainImageClickRef = useRef(false);
  const suppressMainImageClickTimeoutRef = useRef<number | null>(null);

  const handleMainTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (swipeSettleTimeoutRef.current !== null) {
      window.clearTimeout(swipeSettleTimeoutRef.current);
      swipeSettleTimeoutRef.current = null;
    }
    if (swipeAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(swipeAnimationFrameRef.current);
      swipeAnimationFrameRef.current = null;
    }
    setIsSwipeSettling(false);
    setSwipeOffset(0);
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleMainTouchMove = useCallback((event: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start || mobileAssets.length < 2) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return;

    event.preventDefault();
    const width = mainGalleryRef.current?.clientWidth || window.innerWidth;
    setSwipeOffset(Math.max(-width, Math.min(width, deltaX)));
  }, [mobileAssets.length]);

  const handleMainTouchEnd = useCallback((event: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || mobileAssets.length < 2) {
      setSwipeOffset(0);
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const swipeThreshold = 40;

    if (Math.abs(deltaX) < swipeThreshold || Math.abs(deltaX) <= Math.abs(deltaY)) {
      setIsSwipeSettling(false);
      setSwipeOffset(0);
      return;
    }

    // Touch browsers can dispatch a click after touchend. Consume that click so a
    // horizontal swipe changes the slide without opening the image viewer.
    suppressMainImageClickRef.current = true;
    if (suppressMainImageClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressMainImageClickTimeoutRef.current);
    }
    suppressMainImageClickTimeoutRef.current = window.setTimeout(() => {
      suppressMainImageClickRef.current = false;
      suppressMainImageClickTimeoutRef.current = null;
    }, 500);

    const direction = deltaX < 0 ? 1 : -1;
    const width = mainGalleryRef.current?.clientWidth || window.innerWidth;
    setIsSwipeSettling(true);
    // Switch immediately, then animate the incoming asset from the swipe direction
    // into place instead of waiting for the outgoing asset to finish moving away.
    setActiveIndex((current) => {
      const currentVisible = Math.min(current, mobileAssets.length - 1);
      return (currentVisible + direction + mobileAssets.length) % mobileAssets.length;
    });
    setSwipeOffset(direction * width);
    swipeAnimationFrameRef.current = window.requestAnimationFrame(() => {
      setSwipeOffset(0);
      swipeAnimationFrameRef.current = null;
    });
    swipeSettleTimeoutRef.current = window.setTimeout(() => {
      setIsSwipeSettling(false);
      swipeSettleTimeoutRef.current = null;
    }, 220);
  }, [mobileAssets.length]);

  const handleMainImageClick = useCallback((event: React.MouseEvent<HTMLButtonElement>, asset: ImageAsset) => {
    if (suppressMainImageClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressMainImageClickRef.current = false;
      if (suppressMainImageClickTimeoutRef.current !== null) {
        window.clearTimeout(suppressMainImageClickTimeoutRef.current);
        suppressMainImageClickTimeoutRef.current = null;
      }
      return;
    }

    openLightbox(asset);
  }, [openLightbox]);

  useEffect(() => () => {
    if (swipeSettleTimeoutRef.current !== null) {
      window.clearTimeout(swipeSettleTimeoutRef.current);
    }
    if (swipeAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(swipeAnimationFrameRef.current);
    }
    if (suppressMainImageClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressMainImageClickTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!isLightboxOpen || typeof document === 'undefined') return;

    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeLightbox();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateLightbox(1);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateLightbox(-1);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        event.preventDefault();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [closeLightbox, isLightboxOpen, navigateLightbox]);

  const bgMain = dark
    ? 'bg-gradient-to-br from-[#0A1628] to-[#111F34] border-[rgba(10,22,40,0.2)]'
    : 'bg-gradient-to-br from-[#FAFBFD] to-[#FAF7F2] border-[rgba(10,22,40,0.10)]';
  const bgThumb = dark
    ? 'bg-gradient-to-br from-[#0A1628] to-[#111F34]'
    : 'bg-gradient-to-br from-[#FAFBFD] to-[#FAF7F2]';
  const activeKey = activeAsset ? `${activeAsset.type}-${activeAsset.url}` : 'fallback';
  const mainMediaClass =
    'absolute left-1/2 top-1/2 h-full w-full min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 object-cover object-center';
  const thumbMediaClass =
    'h-full w-full object-contain object-center p-1';

  const lightbox = visibleLightboxIndex !== null && activeLightboxAsset && typeof document !== 'undefined'
    ? createPortal(
      <div className="fixed inset-0 z-[2000] bg-white">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Product image viewer"
          className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white"
        >
          <header className="absolute inset-x-0 top-0 z-20 flex h-[68px] items-center justify-between bg-gradient-to-b from-white via-white/90 to-transparent px-5 sm:px-8">
            <div className="flex items-baseline gap-3 text-[#0A1628]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em]">Product view</span>
              <span className="text-[12px] tabular-nums text-[#5F6878]" aria-live="polite">
                {visibleLightboxIndex + 1} / {slideAssets.length}
              </span>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeLightbox}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#0A1628]/15 bg-white text-[#0A1628] transition hover:bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A1628] focus-visible:ring-offset-2"
              aria-label="Close image viewer"
            >
              <X className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
            </button>
          </header>

          <div className="relative h-full min-h-0 flex-1 overflow-hidden bg-white">
            <div key={`${activeLightboxAsset.type}-${activeLightboxAsset.url}`} className="absolute inset-0 flex animate-[fadeUp_0.35s_ease] items-center justify-center">
              <div className="aspect-square h-[min(78dvh,88vw)] max-h-[900px] max-w-[900px] overflow-hidden bg-white">
                {activeLightboxAsset.type === 'video' ? (
                  <video
                    src={`${activeLightboxAsset.url}#t=0.1`}
                    className="h-full w-full bg-white object-contain object-center"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={activeLightboxAsset.url}
                    alt={activeLightboxAsset.alt || `Jewellery product view ${visibleLightboxIndex + 1}`}
                    className="h-full w-full object-contain object-center"
                  />
                )}
              </div>
            </div>

            {slideAssets.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => navigateLightbox(-1)}
                  className="absolute left-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#0A1628]/15 bg-white text-[#0A1628] shadow-sm transition hover:bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A1628] focus-visible:ring-offset-2 sm:left-7 sm:h-12 sm:w-12"
                  aria-label="View previous image"
                >
                  <ChevronLeft className="h-6 w-6" strokeWidth={1.6} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateLightbox(1)}
                  className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#0A1628]/15 bg-white text-[#0A1628] shadow-sm transition hover:bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A1628] focus-visible:ring-offset-2 sm:right-7 sm:h-12 sm:w-12"
                  aria-label="View next image"
                >
                  <ChevronRight className="h-6 w-6" strokeWidth={1.6} aria-hidden="true" />
                </button>
              </>
            ) : null}
          </div>

          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-white via-white/95 to-transparent px-4 pb-4 pt-8 sm:px-7 sm:pb-5">
            <div className="mx-auto flex w-full max-w-[520px] justify-start gap-2.5 overflow-x-auto px-1 py-1 sm:justify-center [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {slideAssets.map((asset, index) => {
                const isSelected = index === visibleLightboxIndex;
                return (
                  <button
                    key={`${asset.type}-${asset.url}-${index}`}
                    type="button"
                    onClick={() => setLightboxIndex(index)}
                    className={`relative h-[62px] w-[62px] flex-none overflow-hidden border bg-white p-1 transition sm:h-[74px] sm:w-[74px] ${
                      isSelected
                        ? 'border-[#0A1628] shadow-[0_0_0_1px_#0A1628]'
                        : 'border-[#0A1628]/10 opacity-65 hover:border-[#0A1628]/40 hover:opacity-100'
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A1628] focus-visible:ring-offset-2`}
                    aria-label={`View ${asset.type} ${index + 1}`}
                    aria-current={isSelected ? 'true' : undefined}
                  >
                    {asset.type === 'video' ? (
                      <video
                        src={`${asset.url}#t=0.1`}
                        className="pointer-events-none h-full w-full bg-white object-contain object-center"
                        muted
                        playsInline
                        preload="metadata"
                        aria-hidden="true"
                      />
                    ) : (
                      <img src={asset.url} alt="" className="h-full w-full object-contain object-center" loading="lazy" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <div>
      <div className="hidden lg:block">
        <div className="grid grid-cols-2 gap-1.5">
          {desktopGridAssets.map((asset, index) => {
            const tileKey = `${asset.type}-${asset.url}-${index}`;
            const tileShape = 'aspect-square';
            const tileSurface = asset.type === 'video'
              ? 'border-[rgba(10,22,40,0.12)] bg-white'
              : bgMain;

            return (
              <div key={tileKey} className={`${tileSurface} group relative overflow-hidden rounded-none border ${tileShape}`}>
                <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.18),transparent_54%)]" />
                {asset.type === 'model' ? (
                  <ModelViewer src={asset.url} />
                ) : asset.type === 'video' ? (
                  <ProductVideo key={asset.url} src={asset.url} />
                ) : (
                  <button
                    type="button"
                    onClick={() => openLightbox(asset)}
                    className="absolute inset-0 cursor-zoom-in overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0A1628]"
                    aria-label={`Open ${asset.alt || `product image ${imageAssets.indexOf(asset) + 1}`} in image viewer`}
                  >
                    <img
                      src={asset.url}
                      alt={asset.alt || `Jewellery product media ${imageAssets.indexOf(asset) + 1}`}
                      className={mainMediaClass}
                      loading="lazy"
                    />
                  </button>
                )}
              </div>
            );
          })}
          {desktopGridAssets.length === 0 ? (
            <div className={`${bgMain} col-span-2 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-none border`}>
              <GemSVG style={gemStyle} size={300} color={gemColor} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="lg:hidden">
        {firstMobileImage?.type === 'image' ? (
          <img
            src={firstMobileImage.url}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute h-px w-px opacity-0"
            loading="eager"
            fetchPriority="high"
          />
        ) : null}
        <div
          ref={mainGalleryRef}
          className={`relative mb-3 flex aspect-square w-full touch-pan-y items-center justify-center overflow-hidden rounded-none border ${bgMain} group`}
          onTouchStart={handleMainTouchStart}
          onTouchMove={handleMainTouchMove}
          onTouchEnd={handleMainTouchEnd}
          onTouchCancel={handleMainTouchEnd}
        >
          <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_50%,rgba(10,22,40,0.1),transparent_70%)]" />
          <div
            key={activeKey}
            className={`absolute inset-0 ${isSwipeSettling ? 'transition-transform duration-[220ms] ease-out' : ''}`}
            style={{ transform: `translate3d(${swipeOffset}px, 0, 0)` }}
          >
            {activeAsset?.type === 'model' ? (
              <div className="absolute inset-0 overflow-hidden"><ModelViewer src={activeAsset.url} /></div>
            ) : activeAsset?.type === 'video' ? (
              <div className="absolute inset-0 overflow-hidden">
                <ProductVideo key={activeAsset.url} src={activeAsset.url} />
              </div>
            ) : activeAsset?.type === 'image' ? (
              <button
                type="button"
                onClick={(event) => handleMainImageClick(event, activeAsset)}
                className="absolute inset-0 cursor-zoom-in overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0A1628]"
                aria-label={`Open ${activeAsset.alt || 'product image'} in image viewer`}
              >
                <img
                  src={activeAsset.url}
                  alt={activeAsset.alt || 'Jewellery product media'}
                  className={mainMediaClass}
                  loading={visibleActiveIndex === firstMobileImageIndex ? 'eager' : 'lazy'}
                  fetchPriority={visibleActiveIndex === firstMobileImageIndex ? 'high' : 'auto'}
                />
              </button>
            ) : (
              <div className="flex h-full w-full items-center justify-center transition-transform duration-700 ease-[cubic-bezier(.2,.7,.3,1)] group-hover:scale-105">
                <GemSVG style={gemStyle} size={260} color={gemColor} />
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center gap-[10px]">
            {thumbnailSlots.map((thumb, index) => {
              if (thumb.type === 'placeholder') {
                return (
                  <div
                    key={thumb.key}
                    className={`aspect-square w-[62px] flex-none border border-[rgba(10,22,40,0.08)] ${bgThumb} opacity-35 sm:w-[72px] md:w-[82px]`}
                    aria-hidden="true"
                  />
                );
              }

              const isActive = visibleActiveIndex === index;
              return (
                <button
                  type="button"
                  key={`${thumb.type}-${thumb.url}-${index}`}
                  onClick={() => setActiveIndex(index)}
                  className={`aspect-square w-[62px] flex-none ${bgThumb} flex cursor-pointer items-center justify-center overflow-hidden border p-1.5 transition-all duration-300 sm:w-[72px] md:w-[82px] ${
                    isActive
                      ? 'border-[#0A1628] shadow-[0_0_0_1px_#0A1628_inset]'
                      : 'border-[rgba(10,22,40,0.10)] hover:border-[#0A1628]'
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A1628] focus-visible:ring-offset-2`}
                  aria-label={`View media ${index + 1}`}
                  aria-current={isActive ? 'true' : undefined}
                >
                  {thumb.type === 'model' ? (
                    <div className="flex h-full w-full items-center justify-center bg-[#0A1628] text-[10px] font-semibold uppercase tracking-[0.18em] text-white">3D</div>
                  ) : thumb.type === 'video' ? (
                    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
                      <video
                        src={`${thumb.url}#t=0.1`}
                        className={thumbMediaClass}
                        muted
                        playsInline
                        preload="metadata"
                        aria-hidden="true"
                      />
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                        <Film className="h-4 w-4 text-white drop-shadow-sm" strokeWidth={1.8} aria-hidden="true" />
                      </span>
                      <span className="sr-only">Video</span>
                    </div>
                  ) : (
                    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
                      <img src={thumb.url} alt={thumb.alt || `Product view ${index + 1}`} className={thumbMediaClass} loading="lazy" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {lightbox}
    </div>
  );
}
