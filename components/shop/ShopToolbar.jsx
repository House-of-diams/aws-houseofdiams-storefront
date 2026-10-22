"use client";

import { Select } from "@/components/ui/select";

const SORT_OPTIONS = [
  { value: "best-matches", label: "Best Matches" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "best-sellers", label: "Best Sellers" },
];

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
          .shop-toolbar-sort .shop-sort-trigger {
            min-width: 132px !important;
            height: 44px !important;
            padding: 0 12px !important;
            font-size: 11px !important;
          }
        }
      `}</style>

      {quickFilters}

      <div className="shop-toolbar-count">
        <strong style={{ color: "#0A1628", fontWeight: 600 }}>{count}</strong> {count === 1 ? "piece" : "pieces"}
      </div>

      <div className="shop-toolbar-sort">
        <Select
          value={sort}
          onValueChange={onSortChange}
          options={SORT_OPTIONS}
          validationLabel="Sort products"
          triggerLabel={sort && sort !== "best-matches" ? SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Sort By" : "Sort By"}
          showItemIndicator={false}
          avoidCollisions
          contentAlign="end"
          triggerClassName="shop-sort-trigger !h-[42px] !min-w-[122px] !rounded-none !border-black/15 !bg-white !px-4 !py-0 !font-[family-name:var(--font-family-montserrat)] !text-[11px] !font-semibold !uppercase !tracking-[0.08em] !text-[#0A1628] !shadow-none [&>span:last-child]:!h-auto [&>span:last-child]:!w-auto [&>span:last-child]:!rounded-none [&>span:last-child]:!border-0 [&>span:last-child]:!bg-transparent [&>span:last-child]:!text-[#0A1628]"
          contentClassName="!min-w-[238px] !max-h-none !rounded-none !border-black/10 !bg-white !shadow-[0_10px_26px_rgba(0,0,0,0.16)]"
          itemClassName="!rounded-none !bg-white !px-5 !py-3 !font-[family-name:var(--font-family-montserrat)] !text-[12px] !font-semibold !uppercase !tracking-[0.03em] !text-[#111] focus:!bg-[#F5F5F5] data-[state=checked]:!bg-[#F5F5F5] data-[state=checked]:!text-[#111]"
        />
      </div>
    </div>
  );
}
