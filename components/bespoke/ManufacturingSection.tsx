'use client';
import { mediaUrl } from '@/lib/media-url';

import { useEffect, useRef, useState } from 'react';

function RevealDiv({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        entries[0].target.classList.add('opacity-100', 'translate-y-0');
        entries[0].target.classList.remove('opacity-0', 'translate-y-6');
        obs.disconnect();
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -50px' });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} className={`opacity-0 translate-y-6 transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.2,0.7,0.3,1)] ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

export default function ManufacturingSection() {
  const [items, setItems] = useState<Array<{ id?: string | number; eyebrow?: string; title?: string; description?: string; image_path?: string | null }>>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/public/bespoke/manufacturing');
        const payload = await response.json();
        if (!active) return;
        setItems(Array.isArray(payload?.items) ? payload.items : []);
      } catch {
        if (active) setItems([]);
      }
    })();
    return () => { active = false; };
  }, []);

  if (!items.length) return null;

  return (
    <section className="section-rhythm px-5 sm:px-7 lg:px-[52px]" style={{ background: 'linear-gradient(180deg, #FAFBFD 0%, #F5F7FC 100%)' }}>
      <div className="max-w-[1400px] mx-auto">
        <div className="text-center mb-12">
          <div className="text-[10px] font-normal tracking-[0.32em] text-[#0A1628] uppercase mb-[18px] inline-flex items-center gap-3 before:content-[''] before:w-6 before:h-px before:bg-[#0A1628]">
            Our Manufacturing
          </div>
          <h2 className="font-serif font-light tracking-[0.02em] text-[#0A1628] leading-[1.05]" style={{ fontSize: 'clamp(36px, 5.5vw, 72px)' }}>
            Inside the <em className="not-italic text-[#0A1628] font-normal">Workshop</em>
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
          {items.map((item, i) => (
            <RevealDiv key={item.id ?? i} delay={i * 100}>
              <div className="bg-white border border-[rgba(10,22,40,0.10)] overflow-hidden h-full hover:shadow-[0_24px_60px_rgba(10,22,40,0.12)] transition-all duration-500">
                {item.image_path ? (
                  <img
                    src={mediaUrl(item.image_path)}
                    alt={item.title}
                    className="w-full h-[280px] object-cover"
                  />
                ) : null}
                <div className="p-8">
                  <div className="text-[9px] font-normal tracking-[0.3em] text-[#0A1628] uppercase mb-3.5">{item.eyebrow}</div>
                  <div className="font-serif text-[28px] font-normal text-[#0A1628] mb-3.5 tracking-[0.02em]">{item.title}</div>
                  <p className="text-[12px] font-light leading-[1.9] text-[#292727] tracking-[0.02em]">{item.description}</p>
                </div>
              </div>
            </RevealDiv>
          ))}
        </div>
      </div>
    </section>
  );
}
