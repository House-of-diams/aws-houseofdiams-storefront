"use client";

import { useEffect, useRef, useState } from "react";

const SORT_OPTIONS = [
  { value: "best-matches", label: "Best Matches" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "best-sellers", label: "Best Sellers" },
];

// The sort list opens inside the toolbar, the same way the Metal and Shape panels do. A portal-based select locked page scrolling
// and jumped the page while the toolbar was stuck to the top on phones.
function SortMenu({ sort, onSortChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const label = sort && sort !== "best-matches" ? SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Sort By" : "Sort By";

  return (
    <div className="shop-sort" ref={rootRef}>
      <button
        type="button"
        className="shop-sort-trigger"
        aria-label="Sort products"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="shop-sort-list"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="shop-sort-trigger-label">{label}</span>
        <svg width="16" height="10" viewBox="0 0 16 10" fill="none" aria-hidden="true" style={{ flex: "none", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s ease" }}><path d="m1 1 7 7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {open && (
        <div id="shop-sort-list" className="shop-sort-list" role="listbox" aria-label="Sort products">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={sort === option.value}
              className="shop-sort-option"
              onClick={() => { onSortChange(option.value); setOpen(false); }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShopToolbar({ count, sort, onSortChange, quickFilters }) {
  return (
    <div className="shop-toolbar">
      <style>{`
        .shop-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 4px;
          margin-bottom: 4px;
        }
        .shop-toolbar-count {
          font-family: var(--font-family-montserrat);
          font-size: 11px;
          letter-spacing: .06em;
          color: #6A6A6A;
          white-space: nowrap;
        }
        .shop-sort { position: relative; }
        .shop-sort-trigger {
          min-width: 122px; height: 42px; padding: 0 16px; border: 1px solid rgba(0,0,0,.15); border-radius: 0; background: #fff; color: #0A1628;
          display: flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer;
          font-family: var(--font-family-montserrat); font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
        }
        .shop-sort-trigger-label { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
        .shop-sort-trigger:focus-visible { outline: 2px solid #0A1628; outline-offset: 2px; }
        .shop-sort-list {
          position: absolute; right: 0; top: calc(100% + 10px); z-index: 40; min-width: 238px; padding: 0;
          border: 1px solid rgba(0,0,0,.1); background: #fff; box-shadow: 0 10px 26px rgba(0,0,0,.16);
        }
        .shop-sort-option {
          display: block; width: 100%; padding: 12px 20px; border: 0; border-radius: 0; background: #fff; color: #111; cursor: pointer; text-align: left;
          font-family: var(--font-family-montserrat); font-size: 12px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase;
        }
        .shop-sort-option:hover, .shop-sort-option:focus-visible, .shop-sort-option[aria-selected="true"] { background: #F5F5F5; outline: none; }
        @media (max-width: 768px) {
          .shop-toolbar {
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 4px;
            margin-bottom: 4px;
          }
          .shop-toolbar-count {
            grid-column: 1 / -1;
            grid-row: 2;
            font-size: 10px;
          }
          .shop-sort-trigger { min-width: 110px; height: 40px; padding: 0 12px; }
        }
      `}</style>

      {quickFilters}

      <div className="shop-toolbar-count">
        <strong style={{ color: "#0A1628", fontWeight: 600 }}>{count}</strong> {count === 1 ? "piece" : "pieces"}
      </div>

      <div className="shop-toolbar-sort">
        <SortMenu sort={sort} onSortChange={onSortChange} />
      </div>
    </div>
  );
}
