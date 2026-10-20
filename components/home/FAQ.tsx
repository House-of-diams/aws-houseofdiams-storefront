'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { cinzelFont } from '@/app/fonts';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  preload: false,
  weight: ['400', '500', '600', '700'],
});

type FaqItem = {
  id?: number;
  sort_order: number;
  question: string;
  answer: string;
  is_active: boolean;
};

type FaqSection = {
  title: string;
  subtitle: string;
};

const fallbackSection: FaqSection = {
  title: 'Frequently Asked Questions',
  subtitle: 'Everything customers usually ask before ordering.',
};

const fallbackFaqs: FaqItem[] = [
  {
    sort_order: 1,
    question: "What's the difference between natural and lab-grown diamonds?",
    answer:
      'Both are real diamonds. Natural diamonds form over billions of years beneath the earth, while lab-grown diamonds are created in controlled conditions. They are chemically, physically and optically identical. The key difference is origin and pricing.',
    is_active: true,
  },
  {
    sort_order: 2,
    question: 'Do your diamonds come with certification?',
    answer:
      'Every diamond comes with certification details based on the selected stone. We also provide a House of Diams certificate of authenticity with each order.',
    is_active: true,
  },
  {
    sort_order: 3,
    question: 'Do you ship internationally?',
    answer:
      'Yes. We ship worldwide with secure, tracked, and insured delivery. Customs and duties may vary by country.',
    is_active: true,
  },
];

function RevealDiv({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          entries[0].target.classList.add('opacity-100', 'translate-y-0');
          entries[0].target.classList.remove('opacity-0', 'translate-y-6');
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -50px' }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`opacity-0 translate-y-6 transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.2,0.7,0.3,1)] ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function FAQ() {
  const [section, setSection] = useState<FaqSection>(fallbackSection);
  const [items, setItems] = useState<FaqItem[]>(fallbackFaqs);
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  useEffect(() => {
    let ignore = false;

    const loadFaq = async () => {
      const response = await fetch('/api/public/home-faq')
      const payload = await response.json().catch(() => null)
      const sectionData = payload?.data?.section
      const itemData = payload?.data?.items
      if (ignore || !response.ok || !sectionData?.id) return;

      setSection({
        title: sectionData.title || fallbackSection.title,
        subtitle: sectionData.subtitle || fallbackSection.subtitle,
      });

      if ((itemData?.length ?? 0) > 0) {
        setItems(itemData as FaqItem[]);
        setOpenIdx(0);
      }
    };

    void loadFaq();

    return () => {
      ignore = true;
    };
  }, []);

  const visibleItems = useMemo(
    () => items.filter((item) => item.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [items]
  );

  const toggle = (index: number) => setOpenIdx((prev) => (prev === index ? null : index));

  return (
    <section className={`${plusJakartaSans.className} mx-auto max-w-[980px] px-[52px] py-[var(--space-section-block)] max-lg:px-7 max-md:px-5`}>
      <div className="mb-0 flex flex-col items-center text-center">
        <RevealDiv className="flex justify-center">
          <div className="inline-flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.32em] text-[#0A1628] before:h-px before:w-6 before:bg-[#0A1628] before:content-['']">
            {section.subtitle || 'Frequently Asked'}
          </div>
        </RevealDiv>
        <RevealDiv delay={100}>
          <h2
            className={`${cinzelFont.variable} font-primary-display section-title mt-[18px] text-[#0A1628] leading-[1.05] tracking-[0.02em] max-md:text-[30px]`}
            style={{ fontSize: 'clamp(30px, 5.5vw, 72px)' }}
          >
            {section.title || 'Frequently Asked Questions'}
          </h2>
        </RevealDiv>
      </div>

      <div className="mt-[var(--space-section-block)] overflow-hidden rounded-[28px] border border-[rgba(10,22,40,0.10)] bg-white">
        {visibleItems.map((faq, index) => {
          const isOpen = openIdx === index;

          return (
            <div
              key={faq.id ?? `${faq.question}-${index}`}
                className={`border-b border-[rgba(10,22,40,0.10)] transition-colors duration-300 last:border-b-0 ${
                isOpen ? 'bg-[#F5F7FC]' : 'bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(index)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-5 bg-transparent px-6 py-6 text-left"
              >
                <span className="text-[18px] font-semibold tracking-[0.01em] text-[#0A1628] max-md:text-[16px]">
                  {faq.question}
                </span>
                <span
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                    isOpen
                      ? 'rotate-45 border-[#0A1628] bg-[#0A1628] text-white'
                      : 'border-[rgba(10,22,40,0.12)] bg-white text-[#292727]'
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
                    <path d="M6 1V11M1 6H11" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
              </button>

              <div
                className="overflow-hidden transition-[max-height,padding] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
                style={{ maxHeight: isOpen ? '320px' : '0px', padding: isOpen ? '0 24px 28px' : '0 24px' }}
              >
                <p className="max-w-[760px] text-[14px] font-medium leading-[1.9] tracking-[0.01em] text-[#292727]">
                  {faq.answer}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
