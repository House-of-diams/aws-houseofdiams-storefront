"use client";

import SectionEyebrow from "./SectionEyebrow";
import B2BProcessCard from "./B2BProcessCard";

const STEPS = [
  {
    step: "01",
    eyebrow: "Enquire",
    title: "Share Your Requirements",
    description:
      "Tell us shapes, sizes, grades, and quantities. We can also recommend based on your market and pricing targets.",
  },
  {
    step: "02",
    eyebrow: "Quote",
    title: "Receive a Trade Proposal",
    description:
      "We send availability, pricing, certification options, and timelines with clear grading references.",
  },
  {
    step: "03",
    eyebrow: "QC",
    title: "Approve and Confirm",
    description:
      "We run internal QC and provide photos/videos on request so you can sign off before dispatch.",
  },
  {
    step: "04",
    eyebrow: "Ship",
    title: "Insured Worldwide Delivery",
    description:
      "Fast fulfillment from Surat with insured logistics and tracking. Repeat orders supported with consistent parcels.",
  },
];

export default function B2BProcessSteps() {
  return (
    <section
      className="py-[110px] px-5 sm:px-7 lg:px-[52px] max-md:py-[70px]"
      style={{ background: "linear-gradient(180deg, #FAFBFD 0%, #F5F7FC 100%)" }}
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="text-center mb-12">
          <SectionEyebrow>How It Works</SectionEyebrow>
          <h2
            className="font-serif font-light tracking-[0.02em] text-[#0A1628] leading-[1.05] mt-5"
            style={{ fontSize: "clamp(36px, 5.5vw, 72px)" }}
          >
            Simple. Predictable. Repeatable.
          </h2>
          <p className="text-[12px] font-light tracking-[0.12em] text-[#292727] leading-[1.9] max-w-[720px] mx-auto mt-5">
            A trade-first process designed for speed and clarity from first message to delivery.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-6 max-xl:grid-cols-2 max-md:grid-cols-1">
          {STEPS.map((s) => (
            <B2BProcessCard key={s.step} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}
