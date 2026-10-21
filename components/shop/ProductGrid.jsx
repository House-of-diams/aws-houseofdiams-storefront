"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ProductCard from "./ProductCard";
import ShopToolbar from "./ShopToolbar";
import CategoryQuickFilters from "./CategoryQuickFilters";
import { useWishlistStore } from "@/lib/hooks/useWishlistStore";
import { getProductKey } from "@/lib/product-keys";

const SORT_VALUES = ["best-matches", "price-low", "price-high", "best-sellers"];

/**
 * @typedef {{ id: string; title: string; options: { value: string; label: string, iconUrl?: string | null }[] }} ProductGridFilterGroup
 */

/**
 * @param {{
 *   products: any[]
 *   sourceProducts?: any[]
 *   initialFilters?: Record<string, string[]>
 *   initialPage?: number
 *   filterGroups?: ProductGridFilterGroup[]
 *   masterShapeOptions?: { value: string; label: string; iconUrl?: string | null; displayOrder: number }[]
 *   totalCount?: number
 *   serverPaginated?: boolean
 *   categoryLoadMore?: boolean
 *   onEnquire: (name?: string) => void
 *   wideGutter?: boolean
 * }} props
 */
export default function ProductGrid({ products, sourceProducts = products, initialFilters = {}, initialPage = 1, filterGroups: externalFilterGroups = [], masterShapeOptions = [], totalCount, serverPaginated = false, categoryLoadMore = false, onEnquire, wideGutter = false }) {
  const { wishlist, toggle } = useWishlistStore();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(initialPage);
  const [localSort, setSort] = useState(searchParams?.get("sort") || "best-matches");
  // Server-paginated lists re-sort through the URL, so the URL is the source of truth;
  // local state would stay on its first value after router.push.
  const urlSort = searchParams?.get("sort");
  const sort = serverPaginated ? (SORT_VALUES.includes(urlSort) ? urlSort : "best-matches") : localSort;
  const [loadedProducts, setLoadedProducts] = useState(products);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");

  useEffect(() => {
    if (categoryLoadMore) setLoadedProducts(products);
  }, [categoryLoadMore, products]);

  const pageSize = 24;
  const loadedStart = (Math.max(1, page) - 1) * pageSize;
  const nextLoadPage = page + Math.ceil(loadedProducts.length / pageSize);

  const pageHref = (nextPage) => {
    const params = new URLSearchParams(searchParams?.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const changePage = (nextPage) => {
    if (serverPaginated) {
      router.push(pageHref(nextPage), { scroll: false });
      document.querySelector(".shop-grid-layout")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setPage(nextPage);
    window.history.pushState(null, "", pageHref(nextPage));
    document.querySelector(".shop-grid-layout")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const loadMoreProducts = async () => {
    if (isLoadingMore || loadedStart + loadedProducts.length >= Number(totalCount || 0)) return;

    setIsLoadingMore(true);
    setLoadMoreError("");
    try {
      const params = new URLSearchParams(searchParams?.toString());
      params.set("category", pathname.split("/").filter(Boolean)[0] || "");
      ["subcategory", "option", "shape", "style", "metal", "certificate"].forEach((key) => {
        const value = filters[key]?.[0];
        if (value) params.set(key, value);
        else params.delete(key);
      });
      params.set("page", String(nextLoadPage));
      const response = await fetch(`/api/public/products/category?${params.toString()}`, { cache: "default" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.products)) {
        throw new Error(payload?.error || "Unable to load more products.");
      }
      setLoadedProducts((current) => {
        const existingKeys = new Set(current.map((product) => product.dbId || product.slug));
        return [
          ...current,
          ...payload.products.filter((product) => {
            const key = product.dbId || product.slug;
            if (!key || existingKeys.has(key)) return false;
            existingKeys.add(key);
            return true;
          }),
        ];
      });
    } catch (error) {
      setLoadMoreError(error instanceof Error ? error.message : "Unable to load more products.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleFiltersChange = (nextFilters) => {
    const params = new URLSearchParams(window.location.search);
    params.delete("page");
    ["category", "subcategory", "option", "shape", "style", "metal", "certificate"].forEach((key) => {
      const value = nextFilters[key]?.[0];
      if (value) params.set(key, value);
      else params.delete(key);
    });
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    if (serverPaginated) {
      router.push(href, { scroll: false });
      return;
    }
    setFilters(nextFilters);
    setPage(1);
    window.history.pushState(null, "", href);
  };

  const handleQuickFilterChange = (key, value) => {
    const nextFilters = { ...filters };
    if (value) nextFilters[key] = [value];
    else delete nextFilters[key];
    handleFiltersChange(nextFilters);
  };

  const handleWishlist = (product) => {
    toggle(getProductKey(product));
  };

  const handleClear = () => {
    const nextFilters = { ...filters };
    delete nextFilters.metal;
    delete nextFilters.shape;
    handleFiltersChange(nextFilters);
    setSort("best-matches");
  };

  const handleSortChange = (value) => {
    const params = new URLSearchParams(window.location.search);
    params.delete("page");
    if (value === "best-matches") params.delete("sort");
    else params.set("sort", value);
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    if (serverPaginated) {
      router.push(href, { scroll: false });
      return;
    }
    setSort(value);
    setPage(1);
    window.history.replaceState(null, "", href);
  };

  const baseFilterGroups = useMemo(() => {
    const unique = (values) => Array.from(new Set(values.filter(Boolean)));
    const titleCase = (value) => value.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

    return [
      {
        id: "category",
        title: "Category",
        options: unique(sourceProducts.map((product) => product.mainCategorySlug || product.category)).map((value) => {
          const match = sourceProducts.find((product) => (product.mainCategorySlug || product.category) === value);
          return { value, label: match?.mainCategoryName || titleCase(value) };
        }),
      },
      {
        id: "type",
        title: "Type",
        options: unique(sourceProducts.map((product) => product.type)).map((value) => ({ value, label: titleCase(value) })),
      },
      {
        id: "shape",
        title: "Shape",
        options: unique(sourceProducts.flatMap((product) => product.shapeOptions?.map((shape) => shape.slug) || [])).map((value) => {
          const match = sourceProducts.flatMap((product) => product.shapeOptions || []).find((shape) => shape.slug === value);
          return { value, label: match?.name || titleCase(value) };
        }),
      },
      {
        id: "metal",
        title: "Metal",
        options: unique(sourceProducts.flatMap((product) => product.metalsFull?.map((metal) => metal.slug) || [])).map((value) => {
          const match = sourceProducts.flatMap((product) => product.metalsFull || []).find((metal) => metal.slug === value);
          return { value, label: match?.displayLabel || match?.name || titleCase(value) };
        }),
      },
      {
        id: "certificate",
        title: "Certificate",
        options: unique(sourceProducts.flatMap((product) => product.certificateNames || [])).map((value) => ({ value, label: value })),
      },
      {
        id: "style",
        title: "Style",
        options: unique(sourceProducts.map((product) => product.styleSlug)).map((value) => {
          const match = sourceProducts.find((product) => product.styleSlug === value);
          return { value, label: match?.styleName || titleCase(value) };
        }),
      },
    ].filter((group) => group.options.length > 0);
  }, [sourceProducts]);

  const filterGroups = useMemo(() => {
    const merged = [...externalFilterGroups, ...baseFilterGroups];
    const seen = new Set();
    return merged.filter((group) => {
      if (!group.options?.length) return false;
      if (seen.has(group.id)) return false;
      seen.add(group.id);
      return true;
    });
  }, [externalFilterGroups, baseFilterGroups]);

  const filtered = useMemo(() => {
    if (serverPaginated) return [...(categoryLoadMore ? loadedProducts : products)];
      const list = products.filter((product) => {
      const productCategoryValue = product.mainCategorySlug || product.category;
      if (filters.category?.length && !filters.category.includes(productCategoryValue)) return false;
      if (
        filters.subcategory?.length &&
        !filters.subcategory.includes(product.subcategorySlug) &&
        !(product.linkedSubcategorySlugs || []).some((slug) => filters.subcategory.includes(slug))
      ) return false;
      if (
        filters.option?.length &&
        !filters.option.includes(product.optionSlug) &&
        !(product.linkedOptionSlugs || []).some((slug) => filters.option.includes(slug))
      ) return false;
      if (filters.shape?.length && !(product.shapeOptions || []).some((shape) => filters.shape.includes(shape.slug))) return false;
      if (filters.style?.length && !filters.style.includes(product.styleSlug)) return false;
      if (filters.type?.length && !filters.type.includes(product.type)) return false;
      if (filters.metal?.length && !product.metalsFull.some((metal) => filters.metal.includes(metal.slug))) return false;
      if (filters.certificate?.length && !(product.certificateNames || []).some((certificate) => filters.certificate.includes(certificate))) return false;
      if (filters.size?.length && !(product.ringSizeNames || []).some((size) => filters.size.includes(size))) return false;
      return true;
    });

    list.sort((a, b) => {
      switch (sort) {
        case "price-low":
          return a.priceFrom - b.priceFrom;
        case "price-high":
          return b.priceFrom - a.priceFrom;
        case "best-sellers":
          return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
        default:
          return 0;
      }
    });

    return list;
  }, [categoryLoadMore, filters, loadedProducts, sort, products, serverPaginated]);

  const resolvedTotalCount = serverPaginated ? Number(totalCount || 0) : filtered.length;
  const totalPages = Math.max(1, Math.ceil(resolvedTotalCount / pageSize));
  const resolvedPage = Math.min(page, totalPages);
  const paginatedProducts = serverPaginated ? filtered : filtered.slice((resolvedPage - 1) * pageSize, resolvedPage * pageSize);
  const remainingProductCount = Math.max(0, resolvedTotalCount - loadedStart - loadedProducts.length);

  const metalOptions = filterGroups.find((group) => group.id === "metal")?.options.map((option) => {
    const metal = sourceProducts.flatMap((product) => product.metalsFull || []).find((entry) => entry.slug === option.value);
    return { ...option, color: option.color || metal?.colorHex || null };
  }) || [];
  const availableShapeSlugs = new Set(sourceProducts.flatMap((product) => product.shapeOptions?.map((shape) => shape.slug) || []));
  const shapeOptions = (masterShapeOptions.length > 0
    ? masterShapeOptions
    : filterGroups.find((group) => group.id === "shape")?.options || [])
    .filter((option) => serverPaginated || availableShapeSlugs.has(option.value))
    .sort((left, right) => Number(left.displayOrder || 0) - Number(right.displayOrder || 0));

  return (
    <>
      <style>{`
        .shop-grid-layout {
          width: 100%;
          padding: 0 50px var(--space-section-block);
          display: block;
          background: var(--theme-surface);
        }
        .shop-grid-toolbar {
          position: sticky;
          top: calc(var(--hod-site-header-height, 131px) - 58px);
          z-index: 35;
          padding: 10px 50px 12px;
          margin-bottom: 0;
          background: var(--theme-surface);
          box-shadow: none;
        }
        @media (min-width: 1025px) {
          .shop-grid-layout.shop-grid-wide {
            padding-left: 50px;
            padding-right: 50px;
          }
          .shop-grid-layout.shop-grid-wide .shop-grid-toolbar {
            padding-left: 50px;
            padding-right: 50px;
          }
        }
        .product-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 13px;
          align-items: stretch;
          overflow: visible;
          padding-bottom: var(--space-section-block);
        }
        .shop-product-card-primary-image,
        .shop-product-card-hover-image {
          transition: opacity 420ms ease;
        }
        .shop-product-card-primary-image {
          opacity: 1;
        }
        .shop-product-card-hover-image {
          opacity: 0;
        }
        .shop-product-card-mobile-dots {
          position: absolute;
          right: 9px;
          bottom: 9px;
          z-index: 3;
          display: none;
          align-items: center;
          gap: 4px;
          pointer-events: none;
        }
        .shop-product-card-mobile-dots button {
          display: block;
          width: 5px;
          height: 5px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: rgba(0, 0, 0, .45);
          box-shadow: 0 0 2px rgba(255, 255, 255, .7);
          cursor: pointer;
          transition: width 220ms ease, background-color 220ms ease;
        }
        .shop-product-card-mobile-dots button.is-active {
          width: 10px;
          background: #000;
        }
        @media (hover: hover) and (pointer: fine) {
          .shop-product-card:hover .shop-product-card-primary-image {
            opacity: 0;
          }
          .shop-product-card:hover .shop-product-card-hover-image {
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .shop-product-card-primary-image,
          .shop-product-card-hover-image {
            transition: none;
          }
        }
        @media (max-width: 1024px) {
          .shop-grid-layout {
            padding: 40px 20px var(--space-section-block);
          }
          .shop-grid-toolbar {
            top: var(--hod-site-header-height, 83px);
            padding: 0 20px 2px;
          }
          .product-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 768px) {
          .shop-grid-layout {
            padding: 28px 10px var(--space-section-block);
          }
          .shop-grid-toolbar {
            padding: 0 7px 2px;
          }
          .product-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 13px;
            padding-bottom: var(--space-section-block);
          }
          .shop-product-card-info {
            padding: 9px 7px 15px !important;
          }
          .shop-product-card-title,
          .shop-product-card-price {
            font-size: 12px !important;
          }
          .shop-product-card-material {
            font-size: 10px !important;
          }
          .shop-product-card-mobile-dots {
            display: flex;
          }
          .shop-product-card-primary-image,
          .shop-product-card-hover-image {
            opacity: 1;
            transition: transform 360ms ease;
          }
          .shop-product-card-primary-image {
            transform: translateX(-100%);
          }
          .shop-product-card-hover-image {
            transform: translateX(100%);
          }
          .shop-product-card-primary-image.shop-product-card-mobile-active,
          .shop-product-card-hover-image.shop-product-card-mobile-active {
            transform: translateX(0);
          }
          @media (prefers-reduced-motion: reduce) {
            .shop-product-card-primary-image,
            .shop-product-card-hover-image {
              transition: none;
            }
          }
        }
      `}</style>

      <div className={`shop-grid-layout${wideGutter ? ' shop-grid-wide' : ''}`}>
        <div>
          <div className="shop-grid-toolbar">
            <ShopToolbar
              count={resolvedTotalCount}
              sort={sort}
              onSortChange={handleSortChange}
              quickFilters={<CategoryQuickFilters metalOptions={metalOptions} shapeOptions={shapeOptions} selectedMetal={filters.metal?.[0] || ""} selectedShape={filters.shape?.[0] || ""} onChange={handleQuickFilterChange} />}
            />
          </div>

          {resolvedTotalCount === 0 ? (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "80px 20px" }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "28px", color: "#0A1628", marginBottom: "14px", fontWeight: 400 }}>
                No pieces match your filters
              </h3>
              <p style={{ color: "#6A6A6A", fontSize: "13px", marginBottom: "24px" }}>
                Try adjusting or clearing your selections.
              </p>
              <button
                onClick={handleClear}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "10px",
                  fontWeight: 400,
                  letterSpacing: ".28em",
                  color: "#0A1628",
                  background: "transparent",
                  padding: "15px 32px",
                  border: "1px solid #0A1628",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  transition: "all .4s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#0A1628";
                  e.currentTarget.style.color = "#FAFBFD";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#0A1628";
                }}
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="product-grid">
              {paginatedProducts.map((product) => (
                <ProductCard
                  key={product.dbId || product.slug}
                  product={product}
                  wishlisted={wishlist.includes(getProductKey(product))}
                  onWishlist={handleWishlist}
                  onEnquire={onEnquire}
                  selectedMetalSlug={filters.metal?.[0] || ""}
                  mobileImageCarousel
                />
              ))}
            </div>
          )}

          {categoryLoadMore && remainingProductCount > 0 ? (
            <div style={{ display: "grid", justifyItems: "center", gap: "12px", padding: 0 }}>
              <Link
                href={pageHref(nextLoadPage)}
                onClick={(event) => {
                  event.preventDefault();
                  void loadMoreProducts();
                }}
                aria-disabled={isLoadingMore}
                style={{
                  display: "inline-flex",
                  border: "1px solid #000",
                  borderRadius: 0,
                  padding: "14px 28px",
                  background: "#000",
                  color: "#fff",
                  cursor: isLoadingMore ? "wait" : "pointer",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: ".08em",
                  opacity: isLoadingMore ? .7 : 1,
                  textDecoration: "none",
                }}
              >
                {isLoadingMore ? "Loading products…" : `Load more (${remainingProductCount}) products`}
              </Link>
              {loadMoreError ? <p role="alert" style={{ color: "#a11", fontSize: "12px", margin: 0 }}>{loadMoreError}</p> : null}
            </div>
          ) : !categoryLoadMore && resolvedTotalCount > pageSize ? (
            <nav aria-label="Product pagination" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", padding: 0 }}>
              {resolvedPage > 1 ? (
                <Link
                  href={pageHref(resolvedPage - 1)}
                  onClick={(event) => { event.preventDefault(); changePage(resolvedPage - 1); }}
                  style={{ border: "1px solid rgba(10,22,40,.2)", borderRadius: 0, padding: "11px 20px", color: "#0A1628", textDecoration: "none", fontSize: "12px" }}
                >
                  Previous
                </Link>
              ) : null}
              <span style={{ color: "#6A6A6A", fontSize: "12px" }}>Page {resolvedPage} of {totalPages}</span>
              {resolvedPage < totalPages ? (
                <Link
                  href={pageHref(resolvedPage + 1)}
                  onClick={(event) => { event.preventDefault(); changePage(resolvedPage + 1); }}
                  style={{ border: "1px solid rgba(10,22,40,.2)", borderRadius: 0, padding: "11px 20px", color: "#0A1628", textDecoration: "none", fontSize: "12px" }}
                >
                  Next
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </div>
    </>
  );
}
