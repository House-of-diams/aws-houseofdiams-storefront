'use client';

import AboutHero from '@/components/about/AboutHero';
import AboutWideBanner from '@/components/about/AboutWideBanner';
import FoundersSection from '@/components/about/FoundersSection';
import TimelineSection from '@/components/about/TimelineSection';
import ValuesSection from '@/components/about/ValuesSection';

export type AboutHeroContent = {
  is_enabled?: boolean; media_type?: 'image' | 'video'; desktop_media_url?: string; mobile_media_url?: string;
  video_poster_url?: string; media_alt?: string | null; show_text_overlay?: boolean; heading?: string | null;
  paragraph?: string | null; show_button?: boolean; button_label?: string | null; button_link?: string | null;
  overlay_position?: 'left' | 'center' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right'; overlay_scrim_enabled?: boolean;
}

export type AboutWideBannerContent = {
  is_enabled?: boolean; desktop_image_url?: string; mobile_image_url?: string; image_alt?: string | null;
  heading?: string | null; paragraph?: string | null; show_button?: boolean; button_label?: string | null;
  button_link?: string | null; content_position?: 'left' | 'center' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

export default function AboutClient({ hero, wideBanner, founders, timeline, values }: {
  hero?: AboutHeroContent | null; wideBanner?: AboutWideBannerContent | null;
  founders?: Array<{ sort_order?: number; name: string; designation: string; bio: string; image_path?: string | null }>;
  timeline?: Array<{ id?: number | string; sort_order?: number; year: string; label: string }>;
  values?: Array<{ id?: number | string; sort_order?: number; icon_path?: string | null; title?: string; description?: string; image_path?: string | null; image_alt?: string | null }>;
}) {
  return <div className="min-h-screen bg-white text-(--ink)">
    <AboutHero content={hero} />
    <FoundersSection initialItems={founders ?? []} />
    <AboutWideBanner content={wideBanner} />
    <TimelineSection initialItems={timeline ?? []} />
    <ValuesSection initialItems={values ?? []} />
  </div>;
}

