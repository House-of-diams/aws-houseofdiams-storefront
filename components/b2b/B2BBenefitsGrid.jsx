"use client";

import SectionEyebrow from "./SectionEyebrow";
import B2BBenefitCard from "./B2BBenefitCard";

const BENEFITS = [
  {
    title: "Consistent Quality",
    description:
      "Every order goes through internal quality checks before it ships.",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <polygon points="12,3 19,7 19,17 12,21 5,17 5,7" stroke="#0A1628" strokeWidth="1" />
        <path d="M9 12L11 14L15 10" stroke="#0A1628" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Consistent Parcels",
    description:
      "Matching colour and clarity across parcels with repeatable quality for ongoing collections.",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="6" width="16" height="12" rx="2" stroke="#0A1628" strokeWidth="1" />
        <path d="M4 10H20" stroke="#0A1628" strokeWidth="1" />
      </svg>
    ),
  },
  {
    title: "Fast Turnaround",
    description:
      "Responsive support and rapid fulfilment from Surat with insured worldwide shipping options.",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 12h10" stroke="#0A1628" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M11 7l4 5-4 5" stroke="#0A1628" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="15" y="6" width="6" height="12" rx="2" stroke="#0A1628" strokeWidth="1" opacity="0.6" />
      </svg>
    ),
  },
  {
    title: "Lab-Grown Diamonds",
    description:
      "Lab-grown diamonds for retailers, designers and wholesalers.",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <polygon points="12,3 21,8 18,21 6,21 3,8" stroke="#0A1628" strokeWidth="1" />
      </svg>
    ),
  },
  {
    title: "Bespoke Production",
    description:
      "From CAD to setting: partner with our atelier to manufacture jewellery lines to specification.",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 20V9l8-5 8 5v11" stroke="#0A1628" strokeWidth="1" />
        <path d="M9 20v-7h6v7" stroke="#0A1628" strokeWidth="1" />
      </svg>
    ),
  },
  {
    title: "Trade-Friendly Terms",
    description:
      "Clear quoting, transparent grading, and predictable lead times for long-term partnerships.",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8" stroke="#0A1628" strokeWidth="1" />
        <path d="M12 7v5l3 2" stroke="#0A1628" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function B2BBenefitsGrid() {
  return (
    <section className="py-[110px] px-5 sm:px-7 lg:px-[52px] max-w-[1400px] mx-auto max-md:py-[70px]">
      <div className="text-center mb-12">
        <SectionEyebrow>Why Partners Choose Us</SectionEyebrow>
        <h2
          className="font-serif font-light tracking-[0.02em] text-[#0A1628] leading-[1.05] mt-5"
          style={{ fontSize: "clamp(36px, 5.5vw, 72px)" }}
        >
          Built for Trade
        </h2>
        <p className="text-[12px] font-light tracking-[0.12em] text-[#292727] leading-[1.9] max-w-[680px] mx-auto mt-5">
          Everything we do is designed to make procurement and production easy, consistent, and scalable.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-md:grid-cols-1">
        {BENEFITS.map((b) => (
          <B2BBenefitCard key={b.title} {...b} />
        ))}
      </div>
    </section>
  );
}
