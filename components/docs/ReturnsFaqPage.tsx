'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, Search } from 'lucide-react';
import { getSafeContactHref } from '@/lib/contact-links';
import { mediaUrl } from '@/lib/media-url';

export type ReturnsContactRow = {
  id: number | string;
  label: string;
  value: string;
  note: string | null;
  href: string | null;
  icon_path: string | null;
};

type Item = { id: number; question: string; answer: string; sort_order: number };

export default function ReturnsFaqPage({
  title,
  items,
  contactRows,
}: {
  title: string;
  items: Item[];
  contactRows: ReturnsContactRow[];
}) {
  const [openId, setOpenId] = useState<number | null>(items[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const filteredItems = items.filter((item) => !query.trim() || `${title} ${item.question} ${item.answer}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <main className="min-h-screen bg-(--color-white) px-4 pb-16 pt-12 text-[#222222] sm:px-7 sm:pb-24 sm:pt-16">
      <div className="relative mx-auto max-w-6xl">
        <Link
          href="/faq"
          className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#222222] no-underline underline-offset-4 hover:underline lg:absolute lg:left-0 lg:top-1/2 lg:-translate-y-1/2"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Back
        </Link>
        <h1 className="mt-6 text-center text-[clamp(1.5rem,2.4vw,1.875rem)] uppercase leading-none tracking-[0.04em] text-[#111111] font-bold! lg:mt-0">
          {title}
        </h1>
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="border border-[#e4e4e4] bg-(--color-white) px-6 py-6 sm:px-10 sm:py-8">
          {items.length ? (
            <div className="divide-y divide-[#e4e4e4]">
              {filteredItems.map((item) => {
                const open = openId === item.id;
                return (
                  <section key={item.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : item.id)}
                      aria-expanded={open}
                      className="flex w-full items-center justify-between gap-5 py-4 text-left"
                    >
                      <span className="text-[15px] font-semibold text-[#222222] sm:text-[16px]">{item.question}</span>
                      <ChevronDown
                        size={18}
                        strokeWidth={1.75}
                        aria-hidden="true"
                        className={
                          'shrink-0 text-[#222222] transition-transform duration-300 ' +
                          (open ? 'rotate-180' : '')
                        }
                      />
                    </button>
                    {open ? (
                      <p className="pb-5 text-[13px] leading-[1.75] text-[#292727]">{item.answer}</p>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-[13px] leading-[1.75] text-[#292727]">{query ? 'No matching returns questions found.' : 'No returns questions are published yet.'}</p>
          )}
        </div>

        <div className="space-y-6">
          <div className="border border-[#e4e4e4] bg-(--color-white) px-6 py-8 text-center">
            <h2 className="text-[16px] uppercase tracking-[0.06em] text-[#222222] font-bold!">Quick Actions</h2>
            <Link href="/profile?tab=orders" className="brand-button mt-6 w-full">
              Track My Order
            </Link>
          </div>

          <div className="border border-[#e4e4e4] bg-(--color-white) px-6 py-8">
            <h2 className="text-center text-[16px] uppercase tracking-[0.06em] text-[#222222] font-bold!">
              Have More Questions?
            </h2>
            <div className="mt-4 divide-y divide-[#e4e4e4]">
              {contactRows.map((row) => {
                const href = getSafeContactHref(row.href)
                return <div key={row.id} className="space-y-1 py-5 text-center">
                  {row.icon_path ? (
                    <img
                      src={mediaUrl(row.icon_path)}
                      alt=""
                      className="mx-auto mb-2 h-6 w-6 object-contain"
                    />
                  ) : null}
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#222222]">{row.label}</p>
                  {href ? (
                    <a href={href} className="block text-[13px] text-[#222222] underline underline-offset-4">
                      {row.value}
                    </a>
                  ) : (
                    <p className="text-[13px] leading-[1.75] text-[#292727]">{row.value}</p>
                  )}
                  {row.note ? <p className="text-[12px] leading-[1.6] text-[#292727]">{row.note}</p> : null}
                </div>
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
