import type { Metadata } from 'next';
import HomeClient from '@/components/pages/HomeClient';
import { mapBlogPostRecord, posts as fallbackPosts } from '@/lib/data/blog-posts';
import { getCachedHomeHeroContent, getHomePageData, getHomeSeoData } from '@/lib/home-data';
import { createPageMetadata } from '@/lib/seo';
import { getCachedShopByCategory } from '@/lib/shop-by-category';
import { cachePublicRead, PUBLIC_CACHE_SHORT_SECONDS } from '@/lib/public-cache';
import type { StorefrontPromotion } from '@/components/commerce/PromotionBanner';
import { loadActiveCouponBannerRowsFromRds } from '@/lib/repositories/public-cms-repository';
import { mediaUrl } from '@/lib/media-url';
import { isF7ReadPreviewEnabled } from '@/lib/f7-read-preview';

type BlogTagRow = { tag: string; sort_order: number | null }
type BlogPostRow = {
  id: number
  slug: string
  category: string
  author: string
  date_label: string
  read_time: string
  bg_key: string
  bg_color: string
  title: string
  title_html: string
  subtitle: string
  body_html: string
  hero_image_path: string | null
  is_published: boolean
  sort_order: number | null
  blog_post_tags: BlogTagRow[] | null
}

async function getFeaturedGiftPromotion(): Promise<StorefrontPromotion | null> {
  const now = new Date().toISOString()
  const rows = await loadActiveCouponBannerRowsFromRds(now, 'free_gift') as Array<Record<string, unknown>>
  const data = rows[0]
  if (!data || data.reward_type !== 'free_gift' || (data.usage_limit != null && Number(data.usage_count ?? 0) >= Number(data.usage_limit))) return null
  const product = data.gift_product as Record<string, unknown> | null
  if (!product || product.status !== 'active' || (!isF7ReadPreviewEnabled() && Number(product.stock_quantity ?? 0) < 1)) return null
  const variant = data.gift_variant_data && typeof data.gift_variant_data === 'object' ? data.gift_variant_data as Record<string, unknown> : {}

  const toPublicUrl = mediaUrl
  return {
    id: Number(data.id), code: String(data.code ?? ''), title: String(data.title ?? ''), rewardType: 'free_gift',
    discountValue: Number(data.discount_value ?? 0), minimumOrderAmount: Number(data.minimum_order_amount ?? 0),
    bannerTitle: data.banner_title as string | null, bannerDescription: data.banner_description as string | null,
    bannerImageUrl: toPublicUrl(data.gift_banner_image_url || variant.image_url || product.image_1_path),
    gift: { name: String(product.name ?? ''), slug: String(product.slug ?? ''), sku: product.sku as string | null, imageUrl: toPublicUrl(variant.image_url || product.image_1_path), variantLabel: typeof variant.label === 'string' ? variant.label : '' },
    endsAt: data.ends_at as string | null,
  }

}

// Display only; the coupon and gift stock are re-validated at checkout.
const getCachedFeaturedGiftPromotion = cachePublicRead('home-gift-promotion', getFeaturedGiftPromotion, PUBLIC_CACHE_SHORT_SECONDS)

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getHomeSeoData();

  return createPageMetadata({
    title: seo.title || 'Luxury Diamond Jewelry',
    description: seo.description || 'House of Diams creates certified lab-grown diamond jewelry, including engagement rings, wedding bands, T-bar jewelry, and bespoke commissions.',
    path: '/',
  });
}

export default async function Home() {
  const freshHeroContentPromise = getCachedHomeHeroContent().then((content) => content ?? undefined).catch(() => undefined);
  const shopByCategoryPromise = getCachedShopByCategory().catch(() => null);
  const giftPromotionPromise = getCachedFeaturedGiftPromotion().catch(() => null);
  const {
    heroContent,
    blogRows,
    discoverShapesItems,
    collectionPageConfig,
    bespokeShowcaseSection,
    instagramReels,
    bestSellerSection,
    bestSellerProducts,
  } = await getHomePageData();
  const freshHeroContent = await freshHeroContentPromise;
  const shopByCategory = await shopByCategoryPromise;
  const giftPromotion = await giftPromotionPromise;

  const blogPosts = ((blogRows as BlogPostRow[] | null)?.map((row) =>
    mapBlogPostRecord({
      ...row,
      hero_image_path: row.hero_image_path ?? undefined,
      sort_order: row.sort_order ?? undefined,
      tags: (row.blog_post_tags ?? [])
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((tag) => tag.tag),
    })
  ) ?? fallbackPosts)

  return (
    <HomeClient
      heroContent={freshHeroContent ?? heroContent}
      shopByCategory={shopByCategory}
      blogPosts={blogPosts}
      discoverShapesItems={discoverShapesItems}
      collectionPageConfig={collectionPageConfig}
      bespokeShowcaseSection={bespokeShowcaseSection}
      instagramReels={instagramReels}
      bestSellerSection={bestSellerSection}
      bestSellerProducts={bestSellerProducts}
      giftPromotion={giftPromotion}
    />
  );
}
