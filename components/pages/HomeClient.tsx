'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Hero from '@/components/home/Hero';
import HomeTrustStripe from '@/components/home/HomeTrustStripe';
import ShopByCategory from '@/components/home/ShopByCategory';
import ViewportDeferred from '@/components/home/ViewportDeferred';
import { posts } from '@/lib/data/blog-posts';
import type { BlogPost } from '@/lib/data/blog-posts';
import EnquireModal from '@/components/home/EnquireModal';
import BespokeEnquiryModal from '@/components/home/BespokeEnquiryModal';
import Toast from '@/components/home/Toast';
import type {
  HomeBestSellerProduct,
  HomeBestSellerSection,
  HomeBespokeShowcaseSection,
  HomeDiscoverItem,
  HomeInstagramReelsData,
} from '@/lib/home-data';
import type { ShopByCategoryData } from '@/lib/shop-by-category';
import HomeOfferBanner from '@/components/home/HomeOfferBanner';
import type { HomeOffer } from '@/lib/home-offer';

const DiscoverShapes = dynamic(() => import('@/components/home/DiscoverShapes'), { loading: () => null });
const BestSellers = dynamic(() => import('@/components/home/BestSellers'), { loading: () => null });
const CollectionShowcase = dynamic(() => import('@/components/home/CollectionShowcase'), { loading: () => null });
const BespokeShowcase = dynamic(() => import('@/components/home/BespokeShowcase'), { loading: () => null });
const InstagramReels = dynamic(() => import('@/components/home/InstagramReels'), { loading: () => null });
const Newsletter = dynamic(() => import('@/components/home/Newsletter'), { loading: () => null });
const DeferredBlogGrid = dynamic(() => import('@/components/blog/BlogGrid'), { loading: () => null });

type CollectionPageConfig = {
  pageEnabled: boolean
  showInFooter: boolean
  showHomeShowcase: boolean
  showcaseHeading: string
  showcaseSubtitle: string
  showcaseCtaLabel: string
  showcaseCtaHref: string
  showcaseImageUrl?: string
  showcaseMobileImageUrl?: string
}

type HeroContent = {
  eyebrow: string;
  headline: string;
  subtitle: string;
  slider_enabled?: boolean;
  slider_items?: Array<{
    sort_order: number;
    image_path: string;
    mobile_image_path?: string;
    headline: string;
    subtitle: string;
    button_text: string;
    button_link: string;
  }>;
};

export default function HomeClient({
  heroContent,
  shopByCategory,
  blogPosts = posts,
  discoverShapesItems = [],
  collectionPageConfig,
  bespokeShowcaseSection,
  instagramReels,
  bestSellerSection,
  bestSellerProducts = [],
  homeOffer,
}: {
  heroContent?: HeroContent
  shopByCategory: ShopByCategoryData | null
  blogPosts?: BlogPost[]
  discoverShapesItems?: HomeDiscoverItem[]
  collectionPageConfig: CollectionPageConfig
  bespokeShowcaseSection: HomeBespokeShowcaseSection
  instagramReels: HomeInstagramReelsData
  bestSellerSection: HomeBestSellerSection
  bestSellerProducts?: HomeBestSellerProduct[]
  homeOffer: HomeOffer | null
}) {
  const router = useRouter();
  const [isEnquireOpen, setIsEnquireOpen] = useState(false);
  const [isBespokeEnquireOpen, setIsBespokeEnquireOpen] = useState(false);
  const [enquireGemName, setEnquireGemName] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [showDeferredSections, setShowDeferredSections] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    let idleId: number | null = null;

    const revealDeferredSections = () => {
      if (cancelled) return;
      window.requestAnimationFrame(() => {
        if (!cancelled) {
          setShowDeferredSections(true);
        }
      });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = (window as Window & {
        requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      }).requestIdleCallback(() => revealDeferredSections(), { timeout: 1200 });
    } else if (typeof window !== 'undefined') {
      timeoutId = globalThis.setTimeout(revealDeferredSections, 180);
    } else {
      setShowDeferredSections(true);
    }

    return () => {
      cancelled = true;
      if (timeoutId) {
        globalThis.clearTimeout(timeoutId);
      }
      if (idleId != null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as Window & {
          cancelIdleCallback: (handle: number) => void;
        }).cancelIdleCallback(idleId);
      }
    };
  }, []);

  const handleEnquireClose = () => {
    setIsEnquireOpen(false);
    setEnquireGemName('');
  };

  const handleToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <div className="home-page min-h-screen bg-(--bg) text-(--ink)">
      <Hero initialContent={heroContent} />
      <HomeTrustStripe />
      <ShopByCategory data={shopByCategory} />
      <HomeOfferBanner offer={homeOffer} />
      <>
          {collectionPageConfig.pageEnabled && collectionPageConfig.showHomeShowcase ? <CollectionShowcase config={collectionPageConfig} /> : null}
          <ViewportDeferred minHeight={620}>
            <BestSellers initialSection={bestSellerSection} initialProducts={bestSellerProducts} />
          </ViewportDeferred>
          <ViewportDeferred minHeight={520}>
            <DiscoverShapes initialItems={discoverShapesItems} />
          </ViewportDeferred>
          {bespokeShowcaseSection.isEnabled ? (
            <BespokeShowcase section={bespokeShowcaseSection} onEnquireClick={() => setIsBespokeEnquireOpen(true)} />
          ) : null}
          <InstagramReels data={instagramReels} />
          {showDeferredSections ? (
            <section aria-labelledby="home-blogs-heading" className="section-rhythm bg-[var(--color-brand-accent,#fff)] px-[var(--space-2)] sm:px-[var(--space-3)] lg:px-[var(--space-4)]">
              <div className="w-full">
                <div className="mb-[var(--space-section-block)] flex flex-wrap items-end justify-between gap-[var(--space-4)] max-md:justify-center">
                  <h2 id="home-blogs-heading" className="section-title text-[clamp(1.7rem,2.4vw,2.4rem)] leading-[1.12] text-[var(--theme-heading)]">Blogs</h2>
                  <Link href="/blog" className="hidden items-center gap-3 border-b border-[var(--theme-ink)] pb-1 font-[family-name:var(--font-family-primary)] text-[clamp(0.7rem,0.85vw,0.9rem)] font-semibold uppercase tracking-[0.08em] text-[var(--theme-ink)] no-underline transition-[gap] duration-300 hover:gap-5 md:flex">View All Blogs →</Link>
                </div>
                <DeferredBlogGrid posts={blogPosts} maxPosts={4} compactGrid simplifiedCards onPostClick={(id) => {
                  const target = blogPosts.find((post) => post.id === id)
                  router.push(target?.slug ? `/blog/${target.slug}` : `/blog?post=${id}`)
                }} />
              </div>
            </section>
          ) : null}
      </>
      {/* <Newsletter onToast={handleToast} /> */}

      {isEnquireOpen && <EnquireModal open={isEnquireOpen} piece={enquireGemName} onClose={handleEnquireClose} />}
      <BespokeEnquiryModal open={isBespokeEnquireOpen} onClose={() => setIsBespokeEnquireOpen(false)} />
      <Toast message={toastMessage} visible={showToast} />
    </div>
  );
}
