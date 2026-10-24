// components/product/ProductCTAs.jsx — House of Diams
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCurrency } from '@/context/CurrencyContext';
import { fetchPublicJson } from '@/lib/client/public-json';
import { normalizeWhatsappNumber } from '@/lib/whatsapp';
import { MAX_CART_QUANTITY } from '@/lib/cart-limits';

/**
 * CTA button row: primary purchase and enquiry actions.
 * @param {object}   props
 * @param {object}   props.product      - Full product object
 * @param {function} props.onEnquire    - Opens the enquiry modal
 * @param {string}   props.checkoutHref - Static checkout route for standard products
 * @param {function} props.onAddToCart  - Adds the configured product to cart
 * @param {function} props.onCheckout   - Opens the pre-checkout love letter flow
 * @param {{ quantity: number, onChangeQuantity: (quantity: number) => void, onViewBag: () => void } | null} [props.inBag] - Set when this exact piece is already in the bag; replaces Add To Bag
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

export default function ProductCTAs({ product, ctaMode = 'both', ctaLabel, onEnquire, checkoutHref, onAddToCart, onCheckout, wishlisted = false, onWishlist, inBag = /** @type {{ quantity: number, onChangeQuantity: (quantity: number) => void, onViewBag: () => void } | null} */ (null) }) {
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

  // A piece that is already in the bag is not offered again: its quantity is changed here, or the bag is opened.
  const bagControl = inBag ? (
    <div className="flex w-full items-stretch gap-2" data-testid="in-bag">
      <div role="group" aria-label="This piece is in your bag" className="flex min-h-[58px] flex-1 items-center justify-between gap-3 border border-[var(--color-brand-primary,#000000)] px-4">
        <span className="inline-flex items-center gap-2 font-[family-name:var(--font-family-button)] text-[14px] font-medium">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
          In your bag
        </span>
        <span className="inline-flex items-center border border-black/25">
          <button type="button" onClick={() => inBag.onChangeQuantity(inBag.quantity - 1)} aria-label="Decrease quantity" className="flex h-9 w-9 items-center justify-center border-0 bg-white text-[18px] leading-none hover:bg-black hover:text-white">−</button>
          <span className="flex h-9 min-w-9 items-center justify-center border-x border-black/15 px-2 text-[13px]" aria-live="polite">{inBag.quantity}</span>
          <button type="button" onClick={() => inBag.onChangeQuantity(inBag.quantity + 1)} disabled={inBag.quantity >= MAX_CART_QUANTITY} aria-label="Increase quantity" title={inBag.quantity >= MAX_CART_QUANTITY ? `Maximum ${MAX_CART_QUANTITY} per order` : undefined} className="flex h-9 w-9 items-center justify-center border-0 bg-white text-[18px] leading-none hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-30">+</button>
        </span>
      </div>
      <button type="button" onClick={inBag.onViewBag} className="shrink-0 border border-[var(--color-brand-primary,#000000)] bg-transparent px-5 font-[family-name:var(--font-family-button)] text-[14px] font-medium hover:bg-[var(--color-brand-primary,#000000)] hover:text-white">View bag</button>
    </div>
  ) : addToBagButton;

  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-5">
      {showCheckout ? bagControl : (
        <div className="flex items-stretch gap-2">
          {/* Collection (and hip-hop without checkout) products are enquiry-first: no cart. */}
          {canCheckoutDirectly ? bagControl : null}
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



