"use client";

import Link from "next/link";
import { useState } from "react";
import { cinzelFont } from "@/app/fonts";
import type { HomeHipHopSection } from "@/lib/home-data";
import { resolveLegacyHipHopHref } from "@/lib/legacy-hiphop";
import { mediaUrl } from '@/lib/media-url';

type HipHopSection = {
  eyebrow: string;
  heading_line_1: string;
  heading_line_2: string;
  heading_emphasis: string;
  cta_label: string;
  cta_link: string;
  image_path: string;
  image_alt: string;
};

const defaultSection: HipHopSection = {
  eyebrow: "Hip Hop Collection · House of Diams",
  heading_line_1: "Ice That",
  heading_line_2: "Speaks",
  heading_emphasis: "Louder.",
  cta_label: "Shop Iced Pieces",
  cta_link: "/shop",
  image_path: "",
  image_alt: "House of Diams Hip Hop Collection",
};

function buildImageUrl(path: string) {

  return mediaUrl(path);
}

export default function HipHopShowcase({ initialSection }: { initialSection?: HomeHipHopSection }) {
  const [section] = useState<HipHopSection>(initialSection ?? defaultSection);
  const backgroundUrl = section.image_path ? buildImageUrl(section.image_path) : "";

  return (
    <section className="relative isolate overflow-hidden">
      <div className="relative h-[360px] md:h-auto md:aspect-[1920/620]">
        {backgroundUrl ? (
          <img
            src={backgroundUrl}
            alt={section.image_alt || "House of Diams Hip Hop Collection"}
            className="absolute inset-0 h-full w-full object-cover object-center"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,255,255,0.16),transparent_36%),linear-gradient(135deg,#0b1018_0%,#1f2937_42%,#0a1628_100%)]" />
        )}

        <div className="relative z-10 flex h-full items-end justify-center px-5 py-12 text-center md:justify-start md:px-8 md:py-16 md:text-left lg:px-12 lg:py-20">
          <div className="max-w-[620px]">
            <h2
              className={`${cinzelFont.variable} font-primary-display font-light leading-[0.96] tracking-[0.01em] text-white`}
              style={{ fontSize: "clamp(42px, 7vw, 88px)" }}
            >
              {section.heading_line_1}
              <br />
              {section.heading_line_2}
              <br />
              <span className="text-white/88">{section.heading_emphasis}</span>
            </h2>

            <Link
              href={resolveLegacyHipHopHref(section.cta_link)}
              className="mx-auto mt-8 inline-flex items-center gap-3 rounded-full border border-white/18 bg-white/14 px-7 py-3.5 font-[family-name:var(--font-family-button)] text-[10px] uppercase tracking-[0.28em] text-white backdrop-blur-sm transition hover:bg-white hover:text-[#0A1628] md:mx-0"
            >
              {section.cta_label || "Shop Iced Pieces"}
              <span className="text-sm">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
