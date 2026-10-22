'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { StorefrontProduct } from '@/lib/catalog-products';
import { STONE_MAP } from '@/lib/data/product-config';
import EnquireModal from '@/components/home/EnquireModal';
import { Toast } from '@/components/home/Toast';
import ProductBreadcrumb from '@/components/product/ProductBreadcrumb';
import ProductGallery from '@/components/product/ProductGallery';
import ProductPriceBlock from '@/components/product/ProductPriceBlock';
import ProductMetalComposition from '@/components/product/ProductMetalComposition';
import ProductConfigurator from '@/components/product/ProductConfigurator';
import RingGuide from '@/components/product/RingGuide';
import ProductCTAs from '@/components/product/ProductCTAs';
import ProductTrustRow from '@/components/product/ProductTrustRow';
import ProductTabs from '@/components/product/ProductTabs';
import ProductFaqSection from '@/components/product/ProductFaqSection';
import ServiceBannerSection, { type ServiceBannerData } from '@/components/common/ServiceBannerSection';
import ProductLayout from '@/components/product/ProductLayout';
import YouMayAlsoLike from '@/components/product/YouMayAlsoLike';
import LoveLetterModal from '@/components/product/LoveLetterModal';
import { useWishlistStore } from '@/lib/hooks/useWishlistStore';
import { useCart } from '@/lib/hooks/useCart';
import { getProductKey } from '@/lib/product-keys';
import { saveLoveLetterDraft, type LoveLetterDraft } from '@/lib/love-letter';
import { useCurrency } from '@/context/CurrencyContext';
import { GiftOfferBanner } from '@/components/commerce/GiftOfferBanner';
import type { StorefrontPromotion } from '@/components/commerce/PromotionBanner';
import { useGiftPromotionStatus } from '@/lib/hooks/useGiftPromotionStatus';

const REQUESTED_COUPON_KEY = 'hod_requested_coupon'

interface ProductClientProps {
  product: StorefrontProduct;
  relatedProducts: StorefrontProduct[];
  serviceBanner: ServiceBannerData | null;
  giftPromotion: StorefrontPromotion | null;
}

export default function ProductClient({ product, relatedProducts, serviceBanner, giftPromotion }: ProductClientProps) {
  const router = useRouter();
  const storefrontProduct = product as StorefrontProduct & {
    hiphopCaratLabel: string;
    hiphopCaratValues: string[];
  };
  const searchParams = useSearchParams();
  const [selectedVariantId, setSelectedVariantId] = useState(
    storefrontProduct.metalPurityVariants.find((entry) => entry.isDefault)?.id ||
      storefrontProduct.metalPurityVariants[0]?.id ||
      ''
  );
  const [selectedMetal, setSelectedMetal] = useState(storefrontProduct.metals[0] ?? '');
  const [selectedHiphopCarat, setSelectedHiphopCarat] = useState(storefrontProduct.hiphopCaratValues[0] ?? '');
  const [selectedRingCategoryId, setSelectedRingCategoryId] = useState(storefrontProduct.ringCategoryId || storefrontProduct.ringCategoryOptions?.[0]?.id || '');
  const activeRingCategory = storefrontProduct.ringCategoryOptions?.find((entry) => entry.id === selectedRingCategoryId) || storefrontProduct.ringCategoryOptions?.[0];
  const [sizeOrFit, setSizeOrFit] = useState(storefrontProduct.chainLengthOptions[0] ?? storefrontProduct.fitOptions[0] ?? storefrontProduct.ringSizeNames[0] ?? '');
  const [selectedRingSize, setSelectedRingSize] = useState(activeRingCategory?.sizes?.[0] ?? storefrontProduct.ringSizeNames[0] ?? '');
  const [selectedGemstoneValue, setSelectedGemstoneValue] = useState(storefrontProduct.gemstoneValues[0] ?? '');
  const [selectedShapeSlug, setSelectedShapeSlug] = useState(storefrontProduct.primaryShapeSlug || storefrontProduct.shapeOptions[0]?.slug || '');
  const [engravingMode, setEngravingMode] = useState<'none' | 'custom'>('none');
  const [engravingText, setEngravingText] = useState('');
  const [customSelections, setCustomSelections] = useState<Record<string, string>>(() => Object.fromEntries(storefrontProduct.customDropdowns.filter((group) => group.isRequired && group.options[0]).map((group) => [group.id, group.options[0].id])));
  const { wishlist, contains, toggle } = useWishlistStore();
  const { addItem } = useCart();
  const { format } = useCurrency();
  const [isEnquireOpen, setIsEnquireOpen] = useState(false);
  const [isLoveLetterOpen, setIsLoveLetterOpen] = useState(false);
  const [loveLetterIntent, setLoveLetterIntent] = useState<'cart' | 'checkout' | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [showStickyCartBar, setShowStickyCartBar] = useState(false);
  const [isFooterVisible, setIsFooterVisible] = useState(false);
  const [stickyImageUnavailableUrl, setStickyImageUnavailableUrl] = useState<string | null>(null);
  const [giftOfferAttempted, setGiftOfferAttempted] = useState(false);
  const ctaAnchorRef = useRef<HTMLDivElement | null>(null);
  const pageTopRef = useRef<HTMLDivElement | null>(null);

  const isDark = product.category === 'hiphop';
  const showRingGuide = Boolean(storefrontProduct.ringEnabled || storefrontProduct.type === 'ring');
  const wishlistKey = getProductKey(product);
  const inWishlist = contains(wishlistKey);
  const selectedCombinedVariant =
    storefrontProduct.metalPurityVariants.find((entry) => entry.id === selectedVariantId) ||
    storefrontProduct.metalPurityVariants.find((entry) => entry.isDefault) ||
    storefrontProduct.metalPurityVariants[0] ||
    null;
  const selectedMetalMeta = storefrontProduct.metalsFull.find((entry) => entry.slug === selectedMetal) || storefrontProduct.metalsFull[0];
  const selectedMaterialValueMeta =
    storefrontProduct.materialValueOptions?.find((entry) => entry.name === selectedGemstoneValue) ||
    storefrontProduct.materialValueOptions?.[0] ||
    null;
  const defaultPurityPriceRow =
    storefrontProduct.purityPriceRows.find((entry) => entry.id === storefrontProduct.defaultPurityPriceId) ||
    storefrontProduct.purityPriceRows[0] ||
    null;
  const selectedMetalMedia = storefrontProduct.metalMediaRows.find((entry) => entry.metal_id === selectedMetalMeta?.id) || storefrontProduct.defaultMetalMedia || null;
  const selectedMetalComposition =
    storefrontProduct.metalCompositions.find((entry) => entry.metalId === selectedMetalMeta?.id) ||
    null;
  const activeImageUrls = useMemo<string[]>(() => {
    if (selectedCombinedVariant) {
      const variantImages = selectedCombinedVariant.mediaItems
        .filter((entry) => entry.type === 'image')
        .map((entry) => entry.url)
        .filter(Boolean);
      const fallbackImages = storefrontProduct.defaultVariantMediaItems
        .filter((entry) => entry.type === 'image')
        .map((entry) => entry.url)
        .filter(Boolean);

      if (variantImages.length > 0) return variantImages;
      if (fallbackImages.length > 0) return fallbackImages;
    }

    const metalImages = selectedMetalMedia
      ? [
          selectedMetalMedia.image_1_path,
          selectedMetalMedia.image_2_path,
          selectedMetalMedia.image_3_path,
          selectedMetalMedia.image_4_path,
        ].filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      : [];
    return metalImages.length > 0
      ? metalImages
      : [storefrontProduct.imageUrl, ...(storefrontProduct.galleryUrls || [])].filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  }, [selectedCombinedVariant, selectedMetalMedia, storefrontProduct.defaultVariantMediaItems, storefrontProduct.galleryUrls, storefrontProduct.imageUrl]);
  const activeImageAlts = useMemo<string[]>(() => {
    if (selectedCombinedVariant) {
      const variantAlts = selectedCombinedVariant.mediaItems
        .filter((entry) => entry.type === 'image')
        .map((entry) => entry.altText || product.name);
      const fallbackAlts = storefrontProduct.defaultVariantMediaItems
        .filter((entry) => entry.type === 'image')
        .map((entry) => entry.altText || product.name);

      if (variantAlts.length > 0) return variantAlts;
      if (fallbackAlts.length > 0) return fallbackAlts;
    }

    return storefrontProduct.imageAlts?.length ? storefrontProduct.imageAlts : activeImageUrls.map(() => product.name);
  }, [activeImageUrls, product.name, selectedCombinedVariant, storefrontProduct.defaultVariantMediaItems, storefrontProduct.imageAlts]);
  const activeVideoUrl =
    selectedCombinedVariant?.mediaItems.find((entry) => entry.type === 'video')?.url ||
    storefrontProduct.defaultVariantMediaItems.find((entry) => entry.type === 'video')?.url ||
    selectedMetalMedia?.video_path ||
    storefrontProduct.videoUrl;
  const activePrice = Number(selectedCombinedVariant?.price ?? defaultPurityPriceRow?.price ?? storefrontProduct.priceFrom ?? 0);
  const { cartSubtotal, isValidated: isGiftSelected, validate: validateGift } = useGiftPromotionStatus(giftPromotion);
  const activeProduct = useMemo(
    () => ({
      ...storefrontProduct,
      priceFrom: activePrice,
      imageUrl: activeImageUrls[0] || storefrontProduct.imageUrl,
      galleryUrls: activeImageUrls.length > 1 ? activeImageUrls.slice(1) : [],
      imageAlts: activeImageAlts,
      videoUrl: activeVideoUrl,
      model3dUrl: storefrontProduct.model3dUrl,
    }),
    [activeImageAlts, activeImageUrls, activePrice, activeVideoUrl, storefrontProduct]
  );

  const configuredProduct = useMemo(
    () => ({
      ...activeProduct,
      ringCategoryId: activeRingCategory?.id || storefrontProduct.ringCategoryId,
      ringCategoryName: activeRingCategory?.name || storefrontProduct.ringCategoryName,
      ringSizeNames: storefrontProduct.ringEnabled ? (activeRingCategory?.sizes || storefrontProduct.ringSizeNames) : storefrontProduct.ringSizeNames,
    }),
    [activeProduct, activeRingCategory, storefrontProduct]
  );

  useEffect(() => {
    if (!selectedCombinedVariant) return;
    if (selectedCombinedVariant.metalSlug !== selectedMetal) {
      setSelectedMetal(selectedCombinedVariant.metalSlug);
    }
  }, [selectedCombinedVariant, selectedMetal]);

  useEffect(() => {
    const nextDefaultRingSize = activeRingCategory?.sizes?.[0] ?? storefrontProduct.ringSizeNames[0] ?? '';
    if (!nextDefaultRingSize) {
      setSelectedRingSize('');
      return;
    }

    if (!activeRingCategory?.sizes?.includes(selectedRingSize)) {
      setSelectedRingSize(nextDefaultRingSize);
    }
  }, [activeRingCategory, selectedRingSize, storefrontProduct.ringSizeNames]);

  useEffect(() => {
    const ctaNode = ctaAnchorRef.current;
    const topNode = pageTopRef.current;
    if (!ctaNode || !topNode || typeof window === 'undefined') return;
    let frameId: number | null = null;

    const updateStickyBar = () => {
      const topRect = topNode.getBoundingClientRect();
      const ctaRect = ctaNode.getBoundingClientRect();
      const hasScrolledIntoPage = topRect.top < -240;
      const ctaIsPastHeader = ctaRect.bottom < 110;
      setShowStickyCartBar(hasScrolledIntoPage && ctaIsPastHeader);
    };

    const scheduleStickyBarUpdate = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updateStickyBar();
      });
    };

    updateStickyBar();
    window.addEventListener('scroll', scheduleStickyBarUpdate, { passive: true });
    window.addEventListener('resize', scheduleStickyBarUpdate);
    return () => {
      window.removeEventListener('scroll', scheduleStickyBarUpdate);
      window.removeEventListener('resize', scheduleStickyBarUpdate);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined' || typeof IntersectionObserver === 'undefined') return;

    let footerObserver: IntersectionObserver | null = null;
    let domObserver: MutationObserver | null = null;

    const observeFooter = () => {
      const footerShell = document.getElementById('site-footer-shell');
      if (!footerShell) return false;

      footerObserver = new IntersectionObserver(
        ([entry]) => setIsFooterVisible(Boolean(entry?.isIntersecting)),
        { threshold: 0 },
      );
      footerObserver.observe(footerShell);
      return true;
    };

    if (!observeFooter()) {
      domObserver = new MutationObserver(() => {
        if (observeFooter()) domObserver?.disconnect();
      });
      domObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      footerObserver?.disconnect();
      domObserver?.disconnect();
    };
  }, []);

  const description = useMemo(
    () => product.descriptionText,
    [product]
  );
  const collectionHref = useMemo(
    () => `/${storefrontProduct.mainCategorySlug || 'fine-jewellery'}`,
    [storefrontProduct.mainCategorySlug]
  );
  const collectionLabel = storefrontProduct.mainCategoryName || 'Collection';
  const subcategoryLabel = storefrontProduct.subcategoryName || null;
  const subcategoryHref = useMemo(() => {
    const { mainCategorySlug, subcategorySlug } = storefrontProduct;

    return mainCategorySlug && subcategorySlug
      ? `/${mainCategorySlug}/${subcategorySlug}`
      : null;
  }, [storefrontProduct]);
  const stickySummary = [
    selectedCombinedVariant?.label || selectedMetalMeta?.name,
  ]
    .filter(Boolean)
    .join(' · ');

  const checkoutHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set('slug', product.slug);
    params.set('name', product.name);
    params.set('price', String(activePrice));
    if (activeProduct.imageUrl) params.set('image', activeProduct.imageUrl);
    if (selectedVariantId) params.set('variant', selectedVariantId);
    if (selectedCombinedVariant?.label) {
      params.set('metal', selectedCombinedVariant.label);
    } else if (selectedMetalMeta?.name) {
      params.set('metal', selectedMetalMeta.name);
    }
    if (selectedHiphopCarat) params.set('carat', selectedHiphopCarat);
    if (sizeOrFit) params.set('size', sizeOrFit);
    if (selectedRingSize) params.set('ring_size', selectedRingSize);
    if (selectedGemstoneValue) params.set('gemstone', selectedGemstoneValue);
    if (selectedShapeSlug) params.set('shape', selectedShapeSlug);
    if (isGiftSelected && giftPromotion?.code) params.set('gift_coupon', giftPromotion.code);
    const custom = Object.entries(customSelections).map(([dropdownId, optionId]) => { const group = storefrontProduct.customDropdowns.find((entry) => entry.id === dropdownId); const option = group?.options.find((entry) => entry.id === optionId); return { dropdownId, optionId, label: group?.label, optionLabel: option?.label }; }).sort((a, b) => a.dropdownId.localeCompare(b.dropdownId));
    if (custom.length) params.set('custom', encodeURIComponent(JSON.stringify(custom)));

    const preserveCategory = searchParams.get('category');
    if (preserveCategory) params.set('category', preserveCategory);

    return `/checkout?${params.toString()}`;
  }, [activePrice, activeProduct.imageUrl, customSelections, giftPromotion?.code, isGiftSelected, product.name, product.slug, searchParams, selectedCombinedVariant?.label, selectedGemstoneValue, selectedHiphopCarat, selectedMetalMeta?.name, selectedRingSize, selectedShapeSlug, selectedVariantId, sizeOrFit]);

  const validateCustomSelections = () => {
    const missing = storefrontProduct.customDropdowns.find((group) => group.isRequired && !customSelections[group.id]);
    if (missing) { showToast(`Please select ${missing.label}`); return false; }
    return true;
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const handleWishlistToggle = (item = product) => {
    const result = toggle(getProductKey(item));
    showToast(result === 'removed' ? 'Removed from wishlist' : 'Saved to wishlist');
  };

  const buildCartSelection = (loveLetterDraft: LoveLetterDraft | null = null) => ({
    metalVariantId: selectedVariantId || undefined,
    metal: selectedCombinedVariant?.label || selectedMetalMeta?.name || selectedMetal,
    metalSlug: selectedCombinedVariant?.metalSlug || selectedMetal,
    purity: '',
    resolvedPrice: activePrice,
    resolvedImageUrl: activeProduct.imageUrl || undefined,
    // A ring's size lives in ringSize; sizeOrFit is only a chain length / fit. Non-ring products (earrings...) have no size at all.
    sizeOrFit: showRingGuide ? '' : (storefrontProduct.chainLengthOptions.includes(sizeOrFit) || storefrontProduct.fitOptions.includes(sizeOrFit) ? sizeOrFit : ''),
    ringSize: showRingGuide ? selectedRingSize : '',
    ringCategoryId: showRingGuide ? selectedRingCategoryId : undefined,
    gemstone: selectedGemstoneValue,
    shape: selectedShapeSlug,
    hiphopCarat: selectedHiphopCarat,
    engravingMode,
    engravingText,
    customSelections: storefrontProduct.customDropdowns.flatMap((group) => {
      const option = group.options.find((entry) => entry.id === customSelections[group.id]);
      return option ? [{ dropdownId: group.id, optionId: option.id, label: group.label, optionLabel: option.label }] : [];
    }),
    loveLetter: loveLetterDraft,
  });

  // Same rule as the product buttons and the server checkout: collection products are enquiry-first.
  const canAddToCart = storefrontProduct.productLane !== 'collection' && (storefrontProduct.productLane !== 'hiphop' || storefrontProduct.allowCheckout);

  const handleAddToCart = () => {
    if (!validateCustomSelections()) return;
    setLoveLetterIntent('cart');
    setIsLoveLetterOpen(true);
  };

  const addConfiguredProductToCart = (loveLetterDraft: LoveLetterDraft | null = null) => {
    addItem(product, {
      ...buildCartSelection(loveLetterDraft),
    }, {
      recommendation: relatedProducts[0]
        ? {
            id: String(relatedProducts[0].id ?? relatedProducts[0].dbId ?? relatedProducts[0].slug),
            dbId: relatedProducts[0].dbId,
            slug: relatedProducts[0].slug,
            name: relatedProducts[0].name,
            shortMeta: relatedProducts[0].shortMeta,
            imageUrl: relatedProducts[0].imageUrl || '',
            priceFrom: relatedProducts[0].priceFrom,
          }
        : undefined,
    });
    if (isGiftSelected && giftPromotion?.code) {
      localStorage.setItem(REQUESTED_COUPON_KEY, giftPromotion.code)
    }
    showToast('Added to cart');
  }

  const handleMetalChange = (metal: string) => {
    setSelectedMetal(metal);
  };

  const handleEngravingModeChange = (mode: string) => {
    if (mode !== 'none' && mode !== 'custom') return;
    setEngravingMode(mode);
    if (mode === 'none') setEngravingText('');
  };

  const handleRelatedEnquire = (name: string) => {
    if (name) showToast(`Opening enquiry for ${name}`);
    setIsEnquireOpen(true);
  };

  const handleCheckoutContinue = (draft: LoveLetterDraft) => {
    if (loveLetterIntent === 'cart') {
      addConfiguredProductToCart(draft);
      setIsLoveLetterOpen(false);
      setLoveLetterIntent(null);
      return;
    }

    saveLoveLetterDraft({
      ...draft,
      sourceSlug: product.slug,
    });
    setIsLoveLetterOpen(false);
    setLoveLetterIntent(null);
    router.push(checkoutHref);
  };

    return (
      <div className="hod-product-detail min-h-screen bg-white text-[var(--color-brand-primary,#000000)]">
      <style>{`
        .hod-product-detail,
        .hod-product-detail .font-sans,
        .hod-product-detail .font-numeric {
          font-family: var(--font-family-secondary), Inter, Arial, Helvetica, sans-serif !important;
        }

        .hod-product-detail .font-display-title {
          font-family: var(--font-family-primary), Montserrat, Arial, Helvetica, sans-serif !important;
        }

        .hod-product-detail .font-sans,
        .hod-product-detail .font-numeric {
          font-size: 14px !important;
        }

        @media (min-width: 1101px) {
          .hod-product-title-axis {
            padding-top: 44px;
          }
        }

      `}</style>
      <div
        className={`fixed left-0 right-0 top-[calc(var(--hod-announcement-current-height,35px)+var(--hod-navbar-visible-height,96px))] z-[45] border-b border-[color:var(--theme-border,rgba(0,0,0,0.09))] bg-white/95 backdrop-blur-md transition-[top,transform,opacity] duration-300 ${
          showStickyCartBar
            ? isFooterVisible
              ? 'translate-y-0 opacity-0 pointer-events-none'
              : 'translate-y-0 opacity-100 pointer-events-auto'
            : '-translate-y-[120%] opacity-0 pointer-events-none max-[700px]:translate-y-[120%]'
        } max-[700px]:top-auto max-[700px]:bottom-0 max-[700px]:border-b-0 max-[700px]:border-t`}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-[52px] py-3 max-[1100px]:px-7 max-[700px]:flex-col max-[700px]:items-stretch max-[700px]:gap-3 max-[700px]:px-5">
          <div className="flex min-w-0 items-center gap-3 max-[700px]:gap-2.5">
            {activeProduct.imageUrl && stickyImageUnavailableUrl !== activeProduct.imageUrl ? (
              <div className="h-14 w-14 shrink-0 overflow-hidden border border-[color:var(--theme-border,rgba(0,0,0,0.09))] bg-[#f7f7f7] max-[700px]:h-[52px] max-[700px]:w-[52px]">
                <img
                  src={activeProduct.imageUrl}
                  alt={activeImageAlts[0] || `${product.name} preview`}
                  className="h-full w-full object-cover object-center"
                  onError={() => setStickyImageUnavailableUrl(activeProduct.imageUrl ?? null)}
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <div className="truncate font-display-title text-[24px] leading-[1.05] text-[var(--color-brand-primary,#000000)] max-[700px]:text-[18px]">
                {product.name}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.14em] text-[var(--theme-muted,#6a6a6a)]">
                {stickySummary ? <span>{stickySummary}</span> : null}
                <span className="font-medium text-[var(--color-brand-primary,#000000)]">{format(activePrice)}</span>
              </div>
            </div>
          </div>
          {canAddToCart ? (<button
            type="button"
            onClick={handleAddToCart}
            className="brand-button max-[700px]:w-full"
          >
            Add To Cart
          </button>) : null}
        </div>
      </div>

        <section ref={pageTopRef} className="mx-auto mt-0 w-full px-3 pb-4 pt-4 sm:pb-6 xl:pb-8 max-[1100px]:px-3 max-[700px]:px-2 max-[700px]:pt-3">
        <ProductLayout
          gallery={(
            <div className="relative z-[1] min-w-0">
              <ProductBreadcrumb
                collectionHref={collectionHref}
                collectionLabel={collectionLabel}
                subcategoryHref={subcategoryHref}
                subcategoryLabel={subcategoryLabel}
              />
              <ProductGallery
                gemStyle={storefrontProduct.gemStyle}
                gemColor={storefrontProduct.gemColor}
                dark={isDark}
                imageUrl={activeProduct.imageUrl}
                galleryUrls={activeProduct.galleryUrls}
                imageAlts={activeProduct.imageAlts}
                videoUrl={activeProduct.videoUrl}
                model3dUrl={activeProduct.model3dUrl}
              />
            </div>
          )}
          info={(
            <div className="hod-product-title-axis">
              <h1 className="font-display-title mb-[10px] text-[clamp(23px,2.6vw,32px)] font-normal leading-[1.12] tracking-[0.01em] text-[var(--color-brand-primary,#000000)]">
                {storefrontProduct.h1Title || product.name}
              </h1>

              <ProductPriceBlock priceFrom={activePrice} compact />

              {giftPromotion ? <GiftOfferBanner promotion={giftPromotion} amount={cartSubtotal} checked={isGiftSelected} included={isGiftSelected} attempted={giftOfferAttempted} onToggle={() => { setGiftOfferAttempted(true); void validateGift() }} /> : null}

              <ProductConfigurator
                product={configuredProduct}
                variantId={selectedVariantId}
                metal={selectedMetal}
                sizeOrFit={sizeOrFit}
                ringSize={selectedRingSize}
                gemstoneValue={selectedGemstoneValue}
                shapeSlug={selectedShapeSlug}
                hiphopCarat={selectedHiphopCarat}
                engravingMode={engravingMode}
                engravingText={engravingText}
                onMetalChange={handleMetalChange}
                onVariantChange={setSelectedVariantId}
                onSizeOrFitChange={setSizeOrFit}
                onRingSizeChange={setSelectedRingSize}
                onGemstoneValueChange={setSelectedGemstoneValue}
                onShapeChange={setSelectedShapeSlug}
                onHiphopCaratChange={setSelectedHiphopCarat}
                onEngravingModeChange={handleEngravingModeChange}
                onEngravingTextChange={setEngravingText}
                priceFrom={activePrice}
                onRingCategoryChange={(value: string) => {
                  setSelectedRingCategoryId(value);
                  const nextCategory = storefrontProduct.ringCategoryOptions?.find((entry) => entry.id === value);
                  if (nextCategory?.sizes?.length) setSelectedRingSize(nextCategory.sizes[0]);
                }}
                customSelections={customSelections}
                onCustomSelectionChange={(groupId: string, optionId: string) => setCustomSelections((current) => ({ ...current, [groupId]: optionId }))}
              />

              <p className="mb-4 px-3 py-4 text-center font-sans text-[20px] leading-[1.35] text-[var(--color-brand-primary,#000000)] sm:px-5 sm:text-[22px]">
                “Get Your Personalized craftsmanship product video. That you know how your product was crafted for you.”
              </p>

              <div ref={ctaAnchorRef}>
                <ProductCTAs
                  product={activeProduct}
                  ctaMode={selectedMaterialValueMeta?.ctaMode || 'both'}
                  ctaLabel={selectedMaterialValueMeta?.ctaLabel || null}
                  wishlisted={inWishlist}
                  onWishlist={() => handleWishlistToggle(product)}
                  onEnquire={() => setIsEnquireOpen(true)}
                  onAddToCart={handleAddToCart}
                  onCheckout={() => {
                    if (!validateCustomSelections()) return;
                    setLoveLetterIntent('checkout');
                    setIsLoveLetterOpen(true);
                  }}
                  checkoutHref={checkoutHref}
                />
              </div>

              <ProductTrustRow />

              {showRingGuide ? <RingGuide /> : null}

              <ProductMetalComposition
                composition={selectedMetalComposition}
                fallbackColor={selectedMetalMeta?.colorHex || '#D4AF37'}
                compact
              />

              <div className="section-rhythm">
                <h2 className="mb-5 font-display-title text-[28px] font-normal leading-[1.1] tracking-[0.01em] text-[var(--color-brand-primary,#000000)]">
                  Know Your Setting
                </h2>
                <div className="sm:hidden">
                  <ProductTabs
                    description={description}
                    specifications={product.specificationRows}
                    productDetails={product.productDetailRows}
                    detailSections={product.detailSections}
                    shippingContent={product.shippingContent}
                    careWarrantyContent={product.careWarrantyContent}
                    detailsAccordion
                  />
                  <ServiceBannerSection data={serviceBanner} />
                </div>
                <div className="hidden sm:block">
                  <ProductTabs
                    description={description}
                    specifications={product.specificationRows}
                    productDetails={product.productDetailRows}
                    detailSections={product.detailSections}
                    shippingContent={product.shippingContent}
                    careWarrantyContent={product.careWarrantyContent}
                    detailsAccordion
                  />
                </div>
              </div>
            </div>
          )}
        />
      </section>

      <div className="hidden sm:block">
        <ServiceBannerSection data={serviceBanner} />
      </div>

      <ProductFaqSection items={product.faqItems} />

      <YouMayAlsoLike
        products={relatedProducts}
        wishlist={wishlist}
        onWishlist={(relatedProduct: StorefrontProduct) => handleWishlistToggle(relatedProduct)}
        onEnquire={handleRelatedEnquire}
      />

      <EnquireModal
        open={isEnquireOpen}
        piece={`${product.name}${selectedGemstoneValue ? ` (${selectedGemstoneValue})` : ` (${STONE_MAP[product.stone] ?? product.stone})`}`}
        onClose={() => setIsEnquireOpen(false)}
      />
      {isLoveLetterOpen ? (
        <LoveLetterModal
          onClose={() => setIsLoveLetterOpen(false)}
          onContinue={handleCheckoutContinue}
        />
      ) : null}

      <Toast message={toastMessage} visible={toastVisible} />
    </div>
  );
}
