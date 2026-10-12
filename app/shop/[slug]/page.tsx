import type { Metadata } from 'next';

export const dynamic = 'force-dynamic'
import { notFound, redirect } from 'next/navigation';
import ProductClient from '@/components/pages/ProductClient';
import type { ServiceBannerData } from '@/components/common/ServiceBannerSection';
import { getRelatedStorefrontProducts, getStorefrontProductBySlug } from '@/lib/catalog-products';
import { createPageMetadata } from '@/lib/seo';
import JsonLd from '@/components/seo/JsonLd';
import { createBreadcrumbSchema, createProductSchema } from '@/lib/structured-data';
import type { StorefrontPromotion } from '@/components/commerce/PromotionBanner';
import { loadServiceBannerFromRds, loadActiveCouponBannerRowsFromRds } from '@/lib/repositories/public-cms-repository';
import { mediaUrl } from '@/lib/media-url';
import { isF7ReadPreviewEnabled } from '@/lib/f7-read-preview';
import { cachePublicRead, PUBLIC_CACHE_LONG_SECONDS, PUBLIC_CACHE_SHORT_SECONDS } from '@/lib/public-cache';

export const revalidate = 60;

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

async function getServiceBanner(): Promise<ServiceBannerData | null> {
  const { section, blocks } = await loadServiceBannerFromRds()
  if (!section?.image_path || !blocks.length) return null

  const imageUrl = mediaUrl(section.image_path)
  return { imageUrl, imageAlt: section.image_alt ?? '', blocks: blocks as ServiceBannerData['blocks'] }

}

async function getFeaturedGiftPromotion(): Promise<StorefrontPromotion | null> {
  const rows = await loadActiveCouponBannerRowsFromRds(new Date().toISOString(), 'free_gift')
  const data = rows[0]
  if (!data || (data.usage_limit != null && Number(data.usage_count ?? 0) >= Number(data.usage_limit))) return null
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

// Same for every product page, so all products share one copy.
// The gift banner is display only; checkout re-validates the coupon and stock.
const getCachedServiceBanner = cachePublicRead('product-page-service-banner', getServiceBanner, PUBLIC_CACHE_LONG_SECONDS)
const getCachedFeaturedGiftPromotion = cachePublicRead('product-page-gift-promotion', getFeaturedGiftPromotion, PUBLIC_CACHE_SHORT_SECONDS)

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getStorefrontProductBySlug(slug);

  if (!product) {
    return {
      title: 'Product Not Found',
      description: 'This product could not be found.',
    };
  }

  return createPageMetadata({
    title: product.seoTitle || product.name,
    description: product.seoDescription || `${product.shortMeta} - House of Diams`,
    path: `/shop/${product.slug}`,
    image: product.imageUrl,
  });
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getStorefrontProductBySlug(slug);

  if (!product) {
    notFound();
  }

  if (product.slug !== slug) {
    redirect(`/shop/${product.slug}`);
  }

  const [relatedProducts, serviceBanner, giftPromotion] = await Promise.all([
    getRelatedStorefrontProducts(product, 7),
    getCachedServiceBanner(),
    getCachedFeaturedGiftPromotion(),
  ]);

  return (
    <>
      <JsonLd
        data={[
          createProductSchema(product),
          createBreadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Shop', path: '/shop' },
            { name: product.name, path: `/shop/${product.slug}` },
          ]),
        ]}
      />
      <ProductClient product={product} relatedProducts={relatedProducts} serviceBanner={serviceBanner} giftPromotion={giftPromotion} />
    </>
  );
}
