'use client';

import { useState } from 'react';
import BannerMedia from '@/components/common/BannerMedia';
import { Plus } from 'lucide-react';

export type ServiceBannerBlock = {
  id: string;
  title: string;
  paragraph: string;
  sort_order: number;
};

export type ServiceBannerData = {
  imageUrl: string;
  imageAlt: string;
  blocks: ServiceBannerBlock[];
};

export default function ServiceBannerSection({ data }: { data: ServiceBannerData | null }) {
  const [openId, setOpenId] = useState<string | null>(data?.blocks[0]?.id ?? null);

  if (!data?.imageUrl || data.blocks.length === 0) return null;

  return (
    <section className="bg-white px-5 py-3 text-[var(--color-brand-primary,#000000)] sm:px-8 sm:py-4 lg:px-[52px] xl:py-6">
      <div className="mx-auto grid max-w-[1600px] items-stretch gap-10 lg:grid-cols-2 lg:gap-[60px]">
        <div className="flex min-w-0 items-center">
          <div className="w-full border-t border-[color:var(--theme-border-strong,rgba(0,0,0,0.2))]">
            {data.blocks.map((block) => {
              const isOpen = openId === block.id;
              const panelId = `service-banner-panel-${block.id}`;

              return (
                <div key={block.id} className="border-b border-[color:var(--theme-border-strong,rgba(0,0,0,0.2))]">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenId((current) => current === block.id ? null : block.id)}
                    className="flex min-h-[76px] w-full items-center justify-between gap-6 bg-white px-1 py-5 text-left font-[family-name:var(--font-family-primary)] text-[15px] font-medium leading-[1.45] text-[var(--color-brand-primary,#000000)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary,#000000)] focus-visible:ring-offset-4 sm:min-h-[82px] sm:text-[16px]"
                  >
                    <span>{block.title}</span>
                    <Plus aria-hidden="true" className={`h-5 w-5 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`} strokeWidth={1.4} />
                  </button>
                  <div id={panelId} className={`grid transition-[grid-template-rows,opacity] duration-300 ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <p className="max-w-[64ch] whitespace-pre-line px-1 pb-6 pr-10 font-[family-name:var(--font-family-secondary)] text-[14px] font-light leading-[1.8] text-[var(--theme-muted,#6a6a6a)]">{block.paragraph}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="order-first relative min-h-[360px] overflow-hidden bg-[var(--color-brand-secondary,#f9f9f9)] sm:min-h-[480px] lg:order-none lg:min-h-[620px]">
          <BannerMedia src={data.imageUrl} alt={data.imageAlt} sizes="(min-width: 1024px) 50vw, 100vw" quality={75} className="object-cover object-center" />
        </div>
      </div>
    </section>
  );
}
