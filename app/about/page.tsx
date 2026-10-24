import type { Metadata } from 'next';
import { createFixedPageMetadata } from '@/lib/page-seo'
import AboutClient from '@/components/pages/AboutClient';
import { loadAboutPageRowsFromRds } from '@/lib/repositories/about-repository';
import { mediaUrl } from '@/lib/media-url';
import { cachePublicRead, PUBLIC_CACHE_LONG_SECONDS } from '@/lib/public-cache';

export function generateMetadata(): Promise<Metadata> {
  return createFixedPageMetadata('about', { title: 'About', description: 'Learn about House of Diams: our founders, milestones, and values.', path: '/about' })
}
export const revalidate = 300;

// The site layout is per-request, so cache the page data itself.
const getCachedAboutPageRows = cachePublicRead('about-page-rows', loadAboutPageRowsFromRds, PUBLIC_CACHE_LONG_SECONDS);

export default async function AboutPage() {

  const publicUrl = mediaUrl;
  const [heroResult, bannerResult, foundersResult, timelineResult, valuesResult] = await getCachedAboutPageRows();
  const hero = heroResult.data ? { ...heroResult.data, desktop_media_url: publicUrl(heroResult.data.desktop_media_path), mobile_media_url: publicUrl(heroResult.data.mobile_media_path || heroResult.data.desktop_media_path), video_poster_url: publicUrl(heroResult.data.video_poster_path) } : null;
  const wideBanner = bannerResult.data ? { ...bannerResult.data, desktop_image_url: publicUrl(bannerResult.data.desktop_image_path), mobile_image_url: publicUrl(bannerResult.data.mobile_image_path || bannerResult.data.desktop_image_path) } : null;
  return <AboutClient hero={hero} wideBanner={wideBanner} founders={foundersResult.data ?? []} timeline={timelineResult.data ?? []} values={valuesResult.data ?? []} />;
}

