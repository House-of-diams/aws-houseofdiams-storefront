// components/product/ProductCTAs.jsx — House of Diams
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCurrency } from '@/context/CurrencyContext';
import { fetchPublicJson } from '@/lib/client/public-json';
import { normalizeWhatsappNumber } from '@/lib/whatsapp';

/**
 * CTA button row: primary purchase and enquiry actions.
 * @param {object}   props
 * @param {object}   props.product      - Full product object
 * @param {function} props.onEnquire    - Opens the enquiry modal
 * @param {string}   props.checkoutHref - Static checkout route for standard products
 * @param {function} props.onAddToCart  - Adds the configured product to cart
 * @param {function} props.onCheckout   - Opens the pre-checkout love letter flow
 * @param {boolean} [props.wishlisted] - Whether this product is saved
 * @param {function} [props.onWishlist] - Toggles the saved state
 * @param {'both'|'checkout_only'|'enquire_only'} [props.ctaMode] - Controls which CTAs are visible
 * @param {string|null|undefined} [props.ctaLabel] - Optional CTA label override from material rules
 */
function WishlistButton({ wishlisted, onWishlist }) {
  if (!onWishlist) return null;

  return (
    <button
      type="button"
      onClick={onWishlist}
      aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-pressed={wishlisted}
      className="inline-flex h-[58px] w-[58px] shrink-0 items-center justify-center bg-[var(--color-brand-primary,#000000)] text-white transition-opacity hover:opacity-80"
    >
      <svg width="27" height="27" viewBox="0 0 32 32" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M16 27.5 4.8 16.7C1.7 13.7 1.7 8.7 4.8 5.8c3-2.8 7.9-2.8 11.2 1 3.3-3.8 8.2-3.8 11.2-1 3.1 2.9 3.1 7.9 0 10.9L16 27.5Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export default function ProductCTAs({ product, ctaMode = 'both', ctaLabel, onEnquire, checkoutHref, onAddToCart, onCheckout, wishlisted = false, onWishlist }) {
  const { format } = useCurrency();
  const [whatsappNumber, setWhatsappNumber] = useState('919328536178');
  useEffect(() => {
    let active = true;
    void fetchPublicJson('/api/public/settings')
      .then(({ payload }) => {
        const savedNumber = normalizeWhatsappNumber(payload?.item?.whatsapp_number);
        if (active && savedNumber) setWhatsappNumber(savedNumber);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  const waText = encodeURIComponent(
    `Hi, I'd like to enquire about the ${product.name} (from ${format(product.priceFrom)})`
  );
  const isCollectionProduct = product.productLane === 'collection';
  const canCheckoutDirectly = !isCollectionProduct && (product.category !== 'hiphop' || Boolean(product.allowCheckout));
  const showWhatsapp = ctaMode !== 'checkout_only';
  const showCheckout = ctaMode !== 'enquire_only' && canCheckoutDirectly;
  const checkoutLabel = ctaLabel || 'Buy Now';
  const addToBagButton = (
    <button
      type="button"
      onClick={onAddToCart}
      className="flex w-full items-center justify-center gap-[10px] border border-[var(--color-brand-primary,#000000)] bg-transparent px-8 py-[18px] font-[family-name:var(--font-family-button)] text-[14px] font-medium normal-case tracking-normal text-[var(--color-brand-primary,#000000)] transition-all duration-400 hover:bg-[var(--color-brand-primary,#000000)] hover:text-[#FAFBFD]"
    >
      Add To Bag
    </button>
  );

  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-5">
      {showCheckout ? addToBagButton : (
        <div className="flex items-stretch gap-2">
          {/* Collection (and hip-hop without checkout) products are enquiry-first: no cart. */}
          {canCheckoutDirectly ? addToBagButton : null}
          <WishlistButton wishlisted={wishlisted} onWishlist={onWishlist} />
        </div>
      )}

      {showCheckout ? (
        <div className="flex items-stretch gap-2">
          {onCheckout ? (
          <button
            type="button"
            onClick={onCheckout}
            className="
              flex w-full items-center justify-center gap-[10px]
              font-[family-name:var(--font-family-button)] text-[14px] font-medium normal-case tracking-normal
              py-[18px] px-5
              bg-[var(--color-brand-primary,#000000)] text-white
              border-0 cursor-pointer no-underline
              transition-all duration-400 ease-out
              
              hover:opacity-80
            "
          >
            <span>{checkoutLabel}</span>
          </button>
        ) : (
          <Link
            href={checkoutHref}
            className="
              flex w-full items-center justify-center gap-[10px]
              font-[family-name:var(--font-family-button)] text-[14px] font-medium normal-case tracking-normal
              py-[18px] px-5
              bg-[var(--color-brand-primary,#000000)] text-white
              border-0 cursor-pointer no-underline
              transition-all duration-400 ease-out
              
              hover:opacity-80
            "
          >
            <span>{checkoutLabel}</span>
          </Link>
          )}
          <WishlistButton wishlisted={wishlisted} onWishlist={onWishlist} />
        </div>
      ) : null}

      {showWhatsapp ? (
        <a
          href={`https://wa.me/${whatsappNumber}?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="
            flex w-full items-center justify-center gap-[10px]
            font-[family-name:var(--font-family-button)] text-[14px] font-medium normal-case tracking-normal
            py-[18px] px-8
            text-[var(--color-brand-primary,#000000)] bg-transparent
            border border-[var(--color-brand-primary,#000000)] cursor-pointer
            transition-all duration-400 no-underline
            hover:bg-[var(--color-brand-primary,#000000)] hover:text-[#FAFBFD]
          "
        >
          {ctaLabel || 'WhatsApp'}
        </a>
      ) : null}
    </div>
  );
}



