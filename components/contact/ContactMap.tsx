'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchPublicJson } from '@/lib/client/public-json';

type ContactInfoRow = {
  id?: number;
  label?: string;
  value?: string;
  note?: string;
};

function RevealDiv({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
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
    >
      {children}
    </div>
  );
}

function isAddressRow(row: ContactInfoRow) {
  const source = `${row.label ?? ''} ${row.note ?? ''}`.toLowerCase();
  return source.includes('address') || source.includes('location') || source.includes('atelier');
}

export default function ContactMap() {
  const [rows, setRows] = useState<ContactInfoRow[]>([]);

  useEffect(() => {
    let ignore = false;

    const loadContactInfo = async () => {
      try {
        const { payload } = await fetchPublicJson<{ items?: ContactInfoRow[] }>('/api/public/contact/info');
        if (ignore) return;
        setRows(Array.isArray(payload?.items) ? payload.items : []);
      } catch {
        if (!ignore) setRows([]);
      }
    };

    void loadContactInfo();

    return () => {
      ignore = true;
    };
  }, []);

  const addressRow = useMemo(() => rows.find(isAddressRow), [rows]);
  const mapQuery = useMemo(() => {
    const parts = [addressRow?.value?.trim(), addressRow?.note?.trim()].filter(Boolean);
    return parts.length ? parts.join(', ') : '';
  }, [addressRow]);
  const mapSrc = mapQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`
    : null;

  return (
    <RevealDiv className="mx-[52px] mb-20 max-lg:mx-7 max-md:mx-5 max-md:mb-12">
      <div
        className="relative h-[320px] overflow-hidden border border-black/12 shadow-[0_12px_35px_rgba(10,22,40,0.06)]"
        style={{
          background: '#fff',
        }}
      >
        {mapSrc ? (
          <iframe
            title={mapQuery || 'House of Diams location'}
            src={mapSrc}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <>
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(10,22,40,0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(10,22,40,0.1) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px',
              }}
            />

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="relative mx-auto mb-4 h-12 w-12">
                <div
                  className="absolute inset-0 rounded-none bg-[rgba(10,22,40,0.2)] animate-ping"
                  style={{ animationDuration: '2s' }}
                />
                <div
                  className="absolute inset-0 bg-black shadow-[0_8px_20px_rgba(10,22,40,0.4)] animate-[mapPinPulse_2s_ease-in-out_infinite]"
                  style={{
                    borderRadius: '50% 50% 50% 0',
                    transform: 'rotate(-45deg)',
                  }}
                >
                  <div className="absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-none bg-white" />
                </div>
              </div>

              <div className="mb-1 font-serif text-[22px] font-normal tracking-[0.02em] text-[var(--theme-ink)]">
                House of Diams Atelier
              </div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-black/60">
                Surat · Gujarat · India
              </div>
            </div>
          </>
        )}
      </div>
    </RevealDiv>
  );
}
