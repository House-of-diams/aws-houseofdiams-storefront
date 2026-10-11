"use client";

import { useEffect, useState } from "react";
import { useMobileSnapCarousel } from "../home/useMobileSnapCarousel";
import { mediaUrl } from '@/lib/media-url';

/**
 * @typedef {Object} ValueItem
 * @property {string | number | undefined} [id]
 * @property {number | undefined} [sort_order]
 * @property {string | null | undefined} [icon_path]
 * @property {string | null | undefined} [image_path]
 * @property {string | null | undefined} [image_alt]
 * @property {string} [title]
 * @property {string} [description]
 */
function publicMediaUrl(path) {
  return mediaUrl(path);
}

function ValueCard({ item }) {
  const imageUrl = publicMediaUrl(item.image_path);
  const iconUrl = publicMediaUrl(item.icon_path);
  return <article
    tabIndex={0}
    className="group relative block aspect-[4/5] w-full overflow-hidden bg-[#e9e9e9] text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
  >
    {imageUrl ? <img src={imageUrl} alt={item.image_alt || item.title} className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 group-focus-within:scale-105" loading="lazy" /> : <div className="absolute inset-0 flex items-center justify-center bg-[#f1f1f1]">{iconUrl ? <img src={iconUrl} alt="" className="size-16 object-contain opacity-60 transition-transform duration-500 group-hover:scale-110 group-focus-within:scale-110" /> : null}</div>}
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent transition-colors duration-500 group-hover:bg-black/68 group-focus-within:bg-black/68" />
    <div className="absolute inset-x-0 bottom-0 z-10 p-5 sm:p-6">
      <h3 className="font-[family-name:var(--font-family-primary)] text-lg font-medium leading-tight text-white sm:text-xl">{item.title}</h3>
      <div className="mt-0 grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity,margin] duration-500 ease-out group-hover:mt-3 group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus-within:mt-3 group-focus-within:grid-rows-[1fr] group-focus-within:opacity-100">
        <div className="overflow-hidden"><p className="font-[family-name:var(--font-family-secondary)] text-xs leading-[1.65] text-white/92 sm:text-sm">{item.description}</p></div>
      </div>
    </div>
  </article>;
}

/** @param {{ initialItems?: ValueItem[] }} props */
export default function ValuesSection({ initialItems = [] }) {
  const { scrollerRef, pauseAutoplay, dragHandlers } = useMobileSnapCarousel();
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(initialItems.length === 0);

  useEffect(() => {
    if (initialItems.length) return;
    let active = true;
    fetch("/api/public/about/values", { cache: "no-store" }).then((response) => response.json()).then((payload) => { if (active) setItems(Array.isArray(payload?.items) ? payload.items : []); }).catch(() => { if (active) setItems([]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialItems]);

  if (loading) return <section className="section-rhythm bg-white px-5 text-center font-[family-name:var(--font-family-secondary)] text-sm text-black/55">Loading values...</section>;
  if (!items.length) return null;

  return <section className="section-rhythm bg-white px-5 sm:px-7 lg:px-[52px]" aria-labelledby="about-values-heading">
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-[var(--space-section-block)] text-left">
        <h2 id="about-values-heading" className="section-title font-[family-name:var(--font-family-primary)] text-[clamp(1.35rem,2.2vw,2rem)] font-medium uppercase leading-none tracking-[0.025em] text-black">Our Values</h2>
      </div>
      <div ref={scrollerRef} {...dragHandlers} onTouchStart={pauseAutoplay} onTouchEnd={pauseAutoplay} onWheel={pauseAutoplay} onKeyDown={pauseAutoplay} className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:hidden [&::-webkit-scrollbar]:hidden" aria-label="Our Values carousel">
        {items.map((item) => {
          const id = String(item.id ?? item.title);
          return <div key={id} className="w-[72vw] max-w-[300px] shrink-0 snap-start"><ValueCard item={item} /></div>;
        })}
      </div>
      <div className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => <ValueCard key={String(item.id ?? item.title)} item={item} />)}
      </div>
    </div>
  </section>;
}


