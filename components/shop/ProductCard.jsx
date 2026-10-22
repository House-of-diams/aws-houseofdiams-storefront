"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useCurrency } from "@/context/CurrencyContext";
import { METAL_META } from "@/lib/data/product-config";

// ── Gem SVG renderer ──────────────────────────────────────────────────────────
export function GemSVG({ style, size = 110, color = "#20304A" }) {
  const c = color;
  const cL = "#0A1628";
  const s = size;

  switch (style) {
    case "pear":
      return (
        <svg width={s} height={s} viewBox="0 0 110 110" fill="none">
          <path d={`M55 15 Q75 38 72 68 Q65 92 55 94 Q45 92 38 68 Q35 38 55 15Z`} stroke={cL} strokeWidth="1" fill={`${c}22`} />
          <path d={`M55 25 Q68 42 65 65 Q60 82 55 84 Q50 82 45 65 Q42 42 55 25Z`} stroke={cL} strokeWidth=".5" fill={`${c}14`} />
          <circle cx="48" cy="45" r="3" fill="#fff" opacity=".6" />
        </svg>
      );
    case "oval":
      return (
        <svg width={s} height={s} viewBox="0 0 110 110" fill="none">
          <ellipse cx="55" cy="55" rx="22" ry="32" stroke={cL} strokeWidth="1" fill={`${c}22`} />
          <ellipse cx="55" cy="55" rx="14" ry="22" stroke={cL} strokeWidth=".5" fill={`${c}14`} />
          <circle cx="50" cy="42" r="4" fill="#fff" opacity=".6" />
        </svg>
      );
    case "emerald":
      return (
        <svg width={s} height={s} viewBox="0 0 110 110" fill="none">
          <rect x="32" y="25" width="46" height="60" stroke={cL} strokeWidth="1" fill={`${c}22`} />
          <rect x="38" y="33" width="34" height="44" stroke={cL} strokeWidth=".5" fill={`${c}14`} />
          <rect x="44" y="41" width="22" height="28" stroke={cL} strokeWidth=".3" fill="none" />
        </svg>
      );
    case "trilogy":
      return (
        <svg width={s} height={s} viewBox="0 0 110 110" fill="none">
          <polygon points="55,18 73,30 68,90 42,90 37,30" stroke={cL} strokeWidth="1" fill={`${c}33`} />
          <polygon points="28,40 38,48 33,80 18,80 13,48" stroke={cL} strokeWidth="0.8" fill="#20304A33" />
          <polygon points="82,40 92,48 87,80 72,80 67,48" stroke={cL} strokeWidth="0.8" fill="#20304A33" />
        </svg>
      );
    case "row":
      return (
        <svg width={s} height={s} viewBox="0 0 110 110" fill="none">
          <rect x="12" y="45" width="86" height="20" rx="10" stroke={cL} strokeWidth="1" fill={`${c}22`} />
          {[22, 38, 55, 72, 88].map((cx) => (
            <circle key={cx} cx={cx} cy="55" r="5" fill={`${c}55`} stroke={cL} strokeWidth=".5" />
          ))}
        </svg>
      );
    case "eternity":
      return (
        <svg width={s} height={s} viewBox="0 0 110 110" fill="none">
          <circle cx="55" cy="55" r="32" stroke={cL} strokeWidth="1" fill="none" />
          <circle cx="55" cy="55" r="26" stroke={cL} strokeWidth="0.5" fill="none" opacity=".4" />
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2;
            const x = 55 + Math.cos(a) * 29;
            const y = 55 + Math.sin(a) * 29;
            return <circle key={i} cx={x} cy={y} r="3.4" fill={`${c}66`} stroke={cL} strokeWidth=".4" />;
          })}
        </svg>
      );
    case "chain":
      return (
        <svg width={s} height={s} viewBox="0 0 110 110" fill="none">
          {[22, 40, 58, 76].map((cy) => (
            <g key={cy}>
              <ellipse cx="55" cy={cy} rx="22" ry="8" stroke={cL} strokeWidth="1" fill={`${c}22`} />
              <rect x="45" y={cy - 2} width="20" height="4" fill={c} />
            </g>
          ))}
        </svg>
      );
    case "tennis":
      return (
        <svg width={s} height={s} viewBox="0 0 110 110" fill="none">
          {[15, 30, 45, 60, 75, 90].map((cx) => (
            <circle key={cx} cx={cx} cy="55" r="6" fill={`${c}55`} stroke={cL} strokeWidth=".6" />
          ))}
          <path d="M15 55 L90 55" stroke={cL} strokeWidth="0.6" />
        </svg>
      );
    case "grillz":
      return (
        <svg width={s} height={s} viewBox="0 0 110 110" fill="none">
          <path d="M20 40 L90 40 L85 80 L25 80 Z" stroke={cL} strokeWidth="1" fill={`${c}33`} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={25 + i * 11} y="45" width="8" height="28" fill={`${c}55`} stroke={cL} strokeWidth=".4" />
          ))}
        </svg>
      );
    case "cross":
      return (
        <svg width={s} height={s} viewBox="0 0 110 110" fill="none">
          <rect x="48" y="20" width="14" height="70" fill={`${c}33`} stroke={cL} strokeWidth="1" />
          <rect x="30" y="42" width="50" height="14" fill={`${c}33`} stroke={cL} strokeWidth="1" />
          {[26, 42, 58, 74].map((y) => (
            <circle key={y} cx="55" cy={y} r="3" fill={c} opacity=".7" />
          ))}
        </svg>
      );
    case "signet":
      return (
        <svg width={s} height={s} viewBox="0 0 110 110" fill="none">
          <rect x="22" y="38" width="66" height="34" rx="4" stroke={cL} strokeWidth="1" fill={`${c}22`} />
          <rect x="30" y="44" width="50" height="22" rx="2" stroke={cL} strokeWidth=".6" fill={`${c}33`} />
          {[40, 55, 70].map((x) => (
            <rect key={x} x={x - 4} y="50" width="8" height="10" fill={c} opacity=".7" />
          ))}
        </svg>
      );
    default: // round
      return (
        <svg width={s} height={s} viewBox="0 0 110 110" fill="none">
          <polygon points="55,15 85,35 77,85 33,85 25,35" stroke={cL} strokeWidth="1" fill={`${c}22`} />
          <polygon points="55,25 75,40 69,75 41,75 35,40" stroke={cL} strokeWidth=".5" fill={`${c}14`} />
          <line x1="55" y1="15" x2="33" y2="85" stroke={cL} strokeWidth=".4" opacity=".5" />
          <line x1="55" y1="15" x2="77" y2="85" stroke={cL} strokeWidth=".4" opacity=".5" />
          <line x1="25" y1="35" x2="85" y2="35" stroke={cL} strokeWidth=".4" opacity=".5" />
          <circle cx="48" cy="35" r="3" fill="#fff" opacity=".7" />
        </svg>
      );
  }
}

// ── ProductCard ───────────────────────────────────────────────────────────────
const LARGE_GEM_STYLES = ["chain", "tennis", "grillz", "cross"];

function getMetalSwatches(product) {
  if (!Array.isArray(product?.metalsFull)) return [];

  return product.metalsFull
    .map((metal) => ({
      id: metal.id || metal.slug,
      metalId: metal.id || null,
      slug: metal.slug || "",
      name: metal.name || metal.slug || "Metal",
      displayLabel: metal.displayLabel || metal.display_label || metal.name || metal.slug || "Metal",
      color:
        metal.colorHex ||
        METAL_META[metal.slug]?.color ||
        METAL_META[(metal.name || "").toLowerCase().replace(/\s+/g, "-")]?.color ||
        null,
    }))
    .filter((metal) => metal.color);
}

function getMetalImages(product, metalSwatch) {
  if (!metalSwatch?.metalId) return [];

  if (Array.isArray(product?.metalPurityVariants)) {
    const variant = product.metalPurityVariants
      .filter((entry) => (
        entry.metalId === metalSwatch.metalId ||
        entry.metal_id === metalSwatch.metalId ||
        entry.metalSlug === metalSwatch.slug ||
        entry.metal_slug === metalSwatch.slug
      ))
      .sort((left, right) => Number(Boolean(right.isDefault)) - Number(Boolean(left.isDefault)))
      .find((entry) => Array.isArray(entry.mediaItems) && entry.mediaItems.some((media) => media.type === "image" && media.url));

    const variantImages = (variant?.mediaItems || [])
      .filter((media) => media.type === "image" && media.url)
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
      .map((media) => media.url);

    if (variantImages.length > 0) return variantImages;
  }

  if (!Array.isArray(product?.metalMediaRows)) return [];

  const match = product.metalMediaRows.find((entry) => (
    entry.metal_id === metalSwatch.metalId ||
    entry.metalId === metalSwatch.metalId ||
    entry.metal_slug === metalSwatch.slug ||
    entry.metalSlug === metalSwatch.slug
  ));
  const source = match || null;
  if (!source) return [];

  return [
    source.image_1_path,
    source.image_2_path,
    source.image_3_path,
    source.image_4_path,
  ].filter(Boolean);
}

export default function ProductCard({ product, wishlisted, onWishlist, onEnquire: _onEnquire, forceLight = false, selectedMetalSlug = "", mobileImageCarousel = false }) {
  const { format } = useCurrency();
  const isDark = !forceLight && product.category === "hiphop";
  const gemSize = LARGE_GEM_STYLES.includes(product.gemStyle) ? 140 : 110;
  const metalSwatches = getMetalSwatches(product);
  const [failedImageUrl, setFailedImageUrl] = useState("");
  const [failedHoverImageUrl, setFailedHoverImageUrl] = useState("");
  const [mobileImageIndex, setMobileImageIndex] = useState(0);
  const touchStartRef = useRef({ x: 0, y: 0 });

  const selectedMetal = selectedMetalSlug ? metalSwatches.find((metal) => metal.slug === selectedMetalSlug) : null;
  const activeMetal = selectedMetal || metalSwatches[0] || null;
  const metalImages = getMetalImages(product, activeMetal);
  const productImages = [product.imageUrl, ...(product.galleryUrls || [])].filter(Boolean);
  const resolvedImages = Array.from(new Set(selectedMetalSlug ? metalImages : [...metalImages, ...productImages]));
  const activeImageUrl = resolvedImages[0] || "";
  const hoverImageUrl = resolvedImages.find((url) => url !== activeImageUrl) || "";
  const visibleImageUrl = activeImageUrl && activeImageUrl !== failedImageUrl ? activeImageUrl : "";
  const visibleHoverImageUrl = hoverImageUrl && hoverImageUrl !== failedHoverImageUrl ? hoverImageUrl : "";
  const hasMobileImageCarousel = mobileImageCarousel && Boolean(visibleHoverImageUrl);

  useEffect(() => {
    setMobileImageIndex(0);
  }, [activeImageUrl, visibleHoverImageUrl]);

  const metalVariantPrices = selectedMetalSlug && Array.isArray(product.metalPurityVariants)
    ? product.metalPurityVariants
        .filter((variant) => variant.metalSlug === selectedMetalSlug && Number(variant.price) > 0)
        .map((variant) => Number(variant.price))
    : [];
  const displayPrice = metalVariantPrices.length ? Math.min(...metalVariantPrices) : product.priceFrom;

  const materialLabel = activeMetal?.displayLabel || activeMetal?.name || product.shortMeta || "";
  const ink = isDark ? "#FFFFFF" : "#111111";
  const muted = isDark ? "rgba(255,255,255,.68)" : "#707070";

  return (
    <a
      className="shop-product-card"
      href={`/shop/${product.slug}`}
      style={{
        position: "relative",
        display: "flex",
        minWidth: 0,
        flexDirection: "column",
        background: isDark ? "#0A1628" : "#FFFFFF",
        color: ink,
        fontFamily: "var(--font-family-inter)",
        textDecoration: "none",
      }}
    >
      <div
        className="shop-product-card-visual"
        style={{
          position: "relative",
          display: "flex",
          aspectRatio: "4 / 5",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          background: isDark ? "linear-gradient(135deg, #0A1628 0%, #111F34 100%)" : "#F7F7F7",
        }}
        onTouchStart={(event) => {
          if (!hasMobileImageCarousel) return;
          const touch = event.touches[0];
          touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          if (!hasMobileImageCarousel) return;
          const touch = event.changedTouches[0];
          const deltaX = touch.clientX - touchStartRef.current.x;
          const deltaY = touch.clientY - touchStartRef.current.y;
          if (Math.abs(deltaX) < 24 || Math.abs(deltaX) < Math.abs(deltaY)) return;
          setMobileImageIndex(deltaX < 0 ? 1 : 0);
        }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onWishlist?.(product);
          }}
          aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={wishlisted}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            zIndex: 2,
            display: "flex",
            width: "36px",
            height: "36px",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            border: 0,
            background: "transparent",
            color: isDark ? "#FFFFFF" : "#555555",
            cursor: "pointer",
          }}
        >
          <svg viewBox="0 0 16 16" fill={wishlisted ? "currentColor" : "none"} width="21" height="21" aria-hidden="true">
            <path d="M8 14L2.5 8.5C1 7 1 4.5 2.5 3C4 1.5 6.5 1.5 8 3C9.5 1.5 12 1.5 13.5 3C15 4.5 15 7 13.5 8.5L8 14Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
          </svg>
        </button>

        {visibleImageUrl ? (
          <>
            <Image
              key={visibleImageUrl}
              src={visibleImageUrl}
              alt={`${product.name} jewellery`}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              onError={() => setFailedImageUrl(visibleImageUrl)}
              className={visibleHoverImageUrl ? `shop-product-card-primary-image${mobileImageIndex === 0 ? " shop-product-card-mobile-active" : ""}` : undefined}
              style={{ objectFit: "cover", objectPosition: "center center" }}
            />
            {visibleHoverImageUrl ? (
              <Image
                key={visibleHoverImageUrl}
                src={visibleHoverImageUrl}
                alt=""
                aria-hidden="true"
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                onError={() => setFailedHoverImageUrl(visibleHoverImageUrl)}
                className={`shop-product-card-hover-image${mobileImageIndex === 1 ? " shop-product-card-mobile-active" : ""}`}
                style={{ objectFit: "cover", objectPosition: "center center" }}
              />
            ) : null}
            {hasMobileImageCarousel ? (
              <div className="shop-product-card-mobile-dots" aria-label="Choose product image">
                {[0, 1].map((index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Show product image ${index + 1}`}
                    aria-pressed={mobileImageIndex === index}
                    className={mobileImageIndex === index ? "is-active" : ""}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setMobileImageIndex(index);
                    }}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : selectedMetalSlug ? (
          <div role="img" aria-label={`${product.name} image unavailable in selected metal`} style={{ padding: "24px", color: muted, fontFamily: "var(--font-family-inter)", fontSize: "12px", textAlign: "center" }}>
            Image unavailable<br />in this metal
          </div>
        ) : (
          <div role="img" aria-label={`${product.name} image unavailable`} style={{ filter: "drop-shadow(0 8px 20px rgba(10,22,40,0.2))" }}>
            <GemSVG style={product.gemStyle} size={gemSize} color={product.gemColor} />
          </div>
        )}
      </div>

      <div
        className="shop-product-card-info"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "3px",
          padding: "10px 10px 18px",
          background: isDark ? "#0A1628" : "#FFFFFF",
          fontFamily: "var(--font-family-inter)",
        }}
      >
        <div className="shop-product-card-title" style={{ color: ink, fontSize: "13px", fontWeight: 600, lineHeight: 1.35 }}>
          {product.name}
        </div>
        <div className="shop-product-card-price" style={{ color: ink, fontSize: "13px", fontWeight: 700, lineHeight: 1.35 }}>
          {format(displayPrice)}
        </div>
        {materialLabel ? (
          <div className="shop-product-card-material" style={{ color: muted, fontSize: "11px", fontWeight: 400, lineHeight: 1.4 }}>
            {materialLabel}
          </div>
        ) : null}
      </div>
    </a>
  );
}

