'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { isVideoUrl } from '@/lib/media-kind';

type Props = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  quality?: number;
  priority?: boolean;
};

// A banner that is a photo or a short looping video. A video does not download until it is close to the screen,
// pauses when it leaves the screen, and does not autoplay for shoppers who asked for reduced motion or less data
// (they get the first frame with play controls instead).
function BannerVideo({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [calm, setCalm] = useState(false);

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    setCalm(window.matchMedia('(prefers-reduced-motion: reduce)').matches || Boolean(connection?.saveData));
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      if (visible) setNear(true);
      if (!calm) {
        if (visible) void node.play().catch(() => undefined);
        else node.pause();
      }
    }, { rootMargin: '200px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [calm, near]);

  return (
    <video
      ref={ref}
      src={near ? src : undefined}
      className={className}
      muted
      loop
      playsInline
      autoPlay={!calm}
      controls={calm}
      preload={near ? 'metadata' : 'none'}
      aria-label={alt}
    />
  );
}

export default function BannerMedia({ src, alt, className = 'object-cover object-center', sizes = '100vw', quality = 90, priority = false }: Props) {
  if (isVideoUrl(src)) return <BannerVideo src={src} alt={alt} className={`absolute inset-0 h-full w-full ${className}`} />;
  return <Image src={src} alt={alt} fill sizes={sizes} quality={quality} priority={priority} className={className} />;
}
