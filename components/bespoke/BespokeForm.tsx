'use client';
import DataNotice from '@/components/consent/DataNotice'

import { useState, useEffect, useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn-select';
import CheckoutField from '@/components/checkout/CheckoutField';

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
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          entries[0].target.classList.add('opacity-100', 'translate-y-0');
          entries[0].target.classList.remove('opacity-0', 'translate-y-6');
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -50px' }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
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

type ConfigRow = {
  id?: string;
  label: string;
  display_order?: number;
};

type FormConfigState = {
  settings: {
    intro_heading: string;
    intro_subtitle: string;
    footer_note: string;
  };
  guarantees: ConfigRow[];
  pieceTypes: ConfigRow[];
  stoneOptions: ConfigRow[];
  caratOptions: ConfigRow[];
  metalOptions: ConfigRow[];
};

const fallbackConfig: FormConfigState = {
  settings: {
    intro_heading: 'Configure Your Bespoke Order',
    intro_subtitle:
      'Every bespoke commission begins with a conversation. Share your vision below and our team will be in touch within 24 hours with next steps.',
    footer_note: "We'll reply within 24 hours. Your details stay confidential.",
  },
  guarantees: [
    { label: 'Free design consultation · no obligation' },
    { label: 'CAD rendering provided before production' },
    { label: 'Insured worldwide shipping complimentary' },
    { label: 'Typically 3-4 weeks from design approval' },
  ],
  pieceTypes: [
    { label: 'Engagement Ring' },
    { label: 'Wedding Band' },
    { label: 'Tennis Bracelet' },
    { label: 'Necklace / Pendant' },
    { label: 'Earrings' },
    { label: 'Loose Diamond' },
    { label: 'Other' },
  ],
  stoneOptions: [
    { label: 'Natural Diamond' },
    { label: 'Colorless Lab-Grown Diamond' },
    { label: 'Fancy Color Lab-Grown Diamond' },
    { label: 'Natural Ruby' },
    { label: 'Natural Emerald' },
    { label: 'Natural Sapphire' },
    { label: 'Need Recommendation' },
  ],
  caratOptions: [
    { label: 'Under 0.5 ct' },
    { label: '0.5 - 1.0 ct' },
    { label: '1.0 - 2.0 ct' },
    { label: '2.0 - 5.0 ct' },
    { label: '5.0 ct+' },
  ],
  metalOptions: [
    { label: '18K Yellow Gold' },
    { label: '18K White Gold' },
    { label: '18K Rose Gold' },
    { label: '14K Gold' },
    { label: 'Platinum' },
    { label: '925 Silver' },
    { label: 'Not Sure' },
  ],
};

const selectClasses =
  'h-12 min-w-0 rounded-none border-[#858585] bg-white px-4 font-[family-name:var(--font-family-montserrat)] text-[16px] font-normal text-[#111111] data-[placeholder]:font-[family-name:var(--font-family-inter)] data-[placeholder]:text-[14px] data-[placeholder]:font-normal data-[placeholder]:text-[#707070] focus:ring-0';

interface BespokeFormProps {
  onSuccess?: () => void;
}

export default function BespokeForm({ onSuccess, initialConfig }: BespokeFormProps & { initialConfig?: FormConfigState }) {
  const [config, setConfig] = useState<FormConfigState>(initialConfig ?? fallbackConfig);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    country: '',
    piece: '',
    stone: '',
    carat: '',
    metal: '',
    message: '',
  });

  const set = (field: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const setTextArea = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  const setDropdown = (field: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/public/bespoke/form-config', { cache: 'no-store' });
        const payload = await response.json();
        if (!active) return;
        setConfig({
          settings: {
            intro_heading: payload?.settings?.intro_heading ?? fallbackConfig.settings.intro_heading,
            intro_subtitle: payload?.settings?.intro_subtitle ?? fallbackConfig.settings.intro_subtitle,
            footer_note: payload?.settings?.footer_note ?? fallbackConfig.settings.footer_note,
          },
          guarantees: Array.isArray(payload?.guarantees) && payload.guarantees.length ? payload.guarantees : fallbackConfig.guarantees,
          pieceTypes: Array.isArray(payload?.pieceTypes) && payload.pieceTypes.length ? payload.pieceTypes : fallbackConfig.pieceTypes,
          stoneOptions: Array.isArray(payload?.stoneOptions) && payload.stoneOptions.length ? payload.stoneOptions : fallbackConfig.stoneOptions,
          caratOptions: Array.isArray(payload?.caratOptions) && payload.caratOptions.length ? payload.caratOptions : fallbackConfig.caratOptions,
          metalOptions: Array.isArray(payload?.metalOptions) && payload.metalOptions.length ? payload.metalOptions : fallbackConfig.metalOptions,
        });
      } catch {
        // Keep the server-provided configuration (or the local fallback) visible
        // if a transient client refresh fails.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/public/bespoke/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          full_name: form.name,
          email: form.email,
          phone: form.phone,
          country: form.country,
          piece_type: form.piece,
          stone_preference: form.stone,
          approx_carat: form.carat,
          preferred_metal: form.metal,
          message: form.message,
        }),
      });

      if (!response.ok) {
        throw new Error((await response.json().catch(() => null))?.error ?? 'Unable to submit enquiry.');
      }

      onSuccess?.();
      setForm({ name: '', email: '', phone: '', country: '', piece: '', stone: '', carat: '', metal: '', message: '' });
    } catch (error) {
      console.error('Bespoke enquiry submission failed:', error);
      setSubmissionError(error instanceof Error ? error.message : 'Unable to submit your enquiry right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="bespoke-form"
      className="section-rhythm border-t border-black/10 bg-white px-4 sm:px-7 lg:px-[50px]"
    >
      <div className="mx-auto grid max-w-6xl min-w-0 grid-cols-[0.85fr_1.15fr] items-start gap-8 lg:gap-12 max-lg:grid-cols-1">
        <RevealDiv className="min-w-0 border border-black/10 bg-white p-5 sm:p-6">
          <div className="mb-3 font-[family-name:var(--font-family-primary)] text-[11px] font-medium uppercase tracking-[0.1em] text-black/60">
            Start Your Piece
          </div>
          <h2 className="section-title mb-[var(--space-section-block)] text-left text-[clamp(1.35rem,2.2vw,2rem)] font-medium uppercase leading-none tracking-[0.025em] text-[var(--color-brand-primary,#000)]">
            {config.settings.intro_heading || 'Configure Your Bespoke Order'}
          </h2>
          <details className="group mt-2 border-t border-black/10 pt-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 font-[family-name:var(--font-family-secondary)] text-[11px] font-medium uppercase tracking-[0.12em] text-black [&::-webkit-details-marker]:hidden">
              More about the process
              <span aria-hidden="true" className="text-lg font-light leading-none transition-transform duration-200 group-open:rotate-180">⌄</span>
            </summary>
            <div className="pb-2">
              <p className="mb-6 font-[family-name:var(--font-family-secondary)] text-[13px] leading-[1.7] text-black/60">
                {config.settings.intro_subtitle}
              </p>
              <div className="flex flex-col gap-3">
                {config.guarantees.map((item, i) => (
                  <div key={item.id ?? i} className="flex items-start gap-3 font-[family-name:var(--font-family-secondary)] text-[12px] leading-[1.6] text-black/60">
                    <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-black" />
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </details>
        </RevealDiv>

        <RevealDiv delay={100} className="min-w-0 w-full">
          <div className="min-w-0 border border-black/10 bg-white p-4 sm:p-5">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                <CheckoutField label="Full Name" required value={form.name} onChange={set('name')} />
                <CheckoutField label="Email" type="email" required value={form.email} onChange={set('email')} />
                <CheckoutField label="Phone / WhatsApp" value={form.phone} onChange={set('phone')} />
                <CheckoutField label="Country" required value={form.country} onChange={set('country')} />

                <div>
                  <input tabIndex={-1} readOnly required aria-label="Piece type" value={form.piece} className="pointer-events-none absolute h-px w-px opacity-0" />
                  <Select
                    value={form.piece}
                    onValueChange={setDropdown('piece')}
                  >
                    <SelectTrigger className={selectClasses}>
                      <SelectValue placeholder="Piece Type *" />
                    </SelectTrigger>
                    <SelectContent>
                      {config.pieceTypes.map((item) => (
                        <SelectItem key={item.id ?? item.label} value={item.label}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Select
                    value={form.stone}
                    onValueChange={setDropdown('stone')}
                  >
                    <SelectTrigger className={selectClasses}>
                      <SelectValue placeholder="Preferred Stone" />
                    </SelectTrigger>
                    <SelectContent>
                      {config.stoneOptions.map((item) => (
                        <SelectItem key={item.id ?? item.label} value={item.label}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Select
                    value={form.carat}
                    onValueChange={setDropdown('carat')}
                  >
                    <SelectTrigger className={selectClasses}>
                      <SelectValue placeholder="Approx. Carat" />
                    </SelectTrigger>
                    <SelectContent>
                      {config.caratOptions.map((item) => (
                        <SelectItem key={item.id ?? item.label} value={item.label}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Select
                    value={form.metal}
                    onValueChange={setDropdown('metal')}
                  >
                    <SelectTrigger className={selectClasses}>
                      <SelectValue placeholder="Preferred Metal" />
                    </SelectTrigger>
                    <SelectContent>
                      {config.metalOptions.map((item) => (
                        <SelectItem key={item.id ?? item.label} value={item.label}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 max-md:col-span-1">
                  <textarea
                    id="b-message"
                    rows={4}
                    required
                    minLength={10}
                    maxLength={5000}
                    value={form.message}
                    onChange={setTextArea('message')}
                    placeholder="Describe Your Vision *"
                    className="min-h-24 w-full resize-y border border-[#858585] bg-white px-4 py-3 font-[family-name:var(--font-family-montserrat)] text-[16px] font-normal text-[#111111] outline-none placeholder:font-[family-name:var(--font-family-inter)] placeholder:text-[14px] placeholder:font-normal placeholder:text-[#707070] focus:border-[#858585]"
                  />
                  <p className="mt-1 text-[11px] text-black/55">Please enter 10–5,000 characters.</p>
                  {submissionError ? <p role="alert" className="mt-1 text-[12px] text-red-600">{submissionError}</p> : null}
                </div>
              </div>

              <DataNotice fields="name, contact details and design brief" purpose="prepare your bespoke consultation and quote" className="mt-5" />
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-black/10 pt-6">
                <p className="text-[13px] text-black/60">
                  {config.settings.footer_note}
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-12 cursor-pointer items-center justify-center border-0 bg-black px-6 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Submitting...' : 'Submit Enquiry'}
                </button>
              </div>
            </form>
          </div>
        </RevealDiv>
      </div>
    </section>
  );
}
