'use client';

import { useEffect, useRef, useState } from 'react';
import { Select } from '@/components/ui/select';
import { cinzelFont } from '@/app/fonts';
import { getSafeContactHref } from '@/lib/contact-links';
import { mediaUrl } from '@/lib/media-url';
import { fetchPublicJson } from '@/lib/client/public-json';

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

interface ContactBodyProps { onSuccess?: (msg: string) => void; }

const inputCls = 'w-full px-4 py-3.5 font-sans text-[13px] font-light text-[var(--theme-ink)] bg-white border border-black/12 shadow-[0_12px_35px_rgba(10,22,40,0.06)] transition-all duration-300 focus:outline-none focus:border-[#0A1628] focus:bg-white tracking-[0.02em]';

function iconFor(label: string) {
  if (label.includes('Email')) return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 5L9 10L16 5M3 3H15C16 3 16 4 16 4V14C16 14 16 15 15 15H3C2 15 2 14 2 14V4C2 4 2 3 3 3Z" stroke="#0A1628" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (label.includes('Phone')) return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M16 12.5V14.5C16 15.3 15.3 16 14.5 16C7.1 16 2 10.9 2 3.5C2 2.7 2.7 2 3.5 2H5.5C6.1 2 6.5 2.4 6.6 3L7 5C7 5.5 6.8 6 6.4 6.3L5.4 7.1C6.3 9 7.5 10.5 9.4 11.4L10.2 10.4C10.5 10 11 9.8 11.5 9.8L13.5 10.2C14.1 10.3 14.5 10.7 14.5 11.3V12.5" stroke="#0A1628" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 16S15 11 15 7C15 3.7 12.3 1 9 1S3 3.7 3 7C3 11 9 16 9 16Z" stroke="#0A1628" strokeWidth="1.2" /><circle cx="9" cy="7" r="2" stroke="#0A1628" strokeWidth="1.2" /></svg>;
}


type ContactRow = { id?: string | number; label: string; value?: string; note?: string; href?: string | null; icon_path?: string | null }

export default function ContactBody({ onSuccess }: ContactBodyProps) {
  const [contactRows, setContactRows] = useState<ContactRow[]>([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', topic: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { payload } = await fetchPublicJson<{ items?: ContactRow[] }>('/api/public/contact/info');
        if (!active) return;
        setContactRows(Array.isArray(payload?.items) ? payload.items : []);
      } catch {
        if (active) setContactRows([]);
      }
    })();
    return () => { active = false; };
  }, []);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  // A ref changes synchronously, so a fast double-click cannot start two requests before the button re-renders as disabled.
  const inFlight = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/public/contact/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ full_name: form.name, email: form.email, phone: form.phone, topic: form.topic, message: form.message }),
      });
      if (response.ok) {
        onSuccess?.('Thanks - your request was submitted successfully.');
        setForm({ name: '', email: '', phone: '', topic: '', message: '' });
      } else {
        onSuccess?.('Sorry, we could not submit your request just now.');
      }
    } catch {
      onSuccess?.('Sorry, we could not submit your request just now.');
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact-form" className="section-rhythm max-w-[1200px] mx-auto px-[52px] grid grid-cols-[1fr_1.4fr] gap-[70px] items-start max-lg:grid-cols-1 max-lg:gap-10 max-lg:px-7 max-md:px-5">
      <RevealDiv>
        <h2 className={`${cinzelFont.variable} font-primary-display text-[32px] font-normal text-[var(--theme-ink)] mb-8 tracking-[0.02em]`}>Reach Us</h2>
        {contactRows.map((row, i) => (
          <div key={row.id ?? row.label} className={`flex items-start gap-[18px] py-[22px] ${i < contactRows.length - 1 ? 'border-b border-[rgba(10,22,40,0.10)]' : ''}`}>
            <div className="w-11 h-11 flex-shrink-0 border border-[rgba(10,22,40,0.25)] rounded-none bg-white flex items-center justify-center">
              {row.icon_path ? (
                <img
                  src={mediaUrl(row.icon_path)}
                  alt={row.label}
                  className="h-4 w-4 object-contain"
                />
              ) : (
                iconFor(row.label)
              )}
            </div>
            <div>
              <div className="text-[9px] font-normal tracking-[0.28em] text-[var(--theme-ink)] uppercase mb-1">{row.label}</div>
              <div className={`text-[18px] font-normal text-[var(--theme-ink)] mb-0.5 ${row.label === 'Phone & WhatsApp' ? 'font-numeric' : 'font-serif'}`}>
                {getSafeContactHref(row.href) ? <a href={getSafeContactHref(row.href)!} className="text-[var(--theme-ink)] no-underline hover:text-[var(--theme-ink)] transition-colors duration-300">{row.value}</a> : row.value}
              </div>
              <div className="text-[10px] text-black/60 tracking-[0.04em]">{row.note}</div>
            </div>
          </div>
        ))}
      </RevealDiv>

      <RevealDiv delay={100}>
        <div className="bg-white px-11 py-11 border border-black/12 shadow-[0_12px_35px_rgba(10,22,40,0.06)] max-md:px-[22px] max-md:py-7">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
              <div><label htmlFor="contact-name" className="block text-[9px] font-normal tracking-[0.28em] text-black/60 uppercase mb-2">Full Name</label><input id="contact-name" required value={form.name} onChange={set('name')} className={inputCls} /></div>
              <div><label htmlFor="contact-email" className="block text-[9px] font-normal tracking-[0.28em] text-black/60 uppercase mb-2">Email</label><input id="contact-email" required type="email" value={form.email} onChange={set('email')} className={inputCls} /></div>
              <div><label htmlFor="contact-phone" className="block text-[9px] font-normal tracking-[0.28em] text-black/60 uppercase mb-2">Phone / WhatsApp</label><input id="contact-phone" value={form.phone} onChange={set('phone')} className={`${inputCls} font-numeric`} /></div>
              <div>
                <label htmlFor="contact-topic" className="block text-[9px] font-normal tracking-[0.28em] text-black/60 uppercase mb-2">Enquiry Topic</label>
                <Select
                  id="contact-topic"
                  required
                  validationLabel="Enquiry topic"
                  value={form.topic}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, topic: value }))}
                  placeholder="Select topic..."
                  options={[
                    { value: 'Product Enquiry', label: 'Product Enquiry' },
                    { value: 'Bespoke Order', label: 'Bespoke Order' },
                    { value: 'B2B Wholesale', label: 'B2B Wholesale' },
                    { value: 'Press / Media', label: 'Press / Media' },
                    { value: 'General Enquiry', label: 'General Enquiry' },
                  ]}
                  triggerClassName={`${inputCls} justify-between bg-white pr-3 shadow-none`}
                />
              </div>
              <div className="col-span-2 max-md:col-span-1"><label htmlFor="contact-message" className="block text-[9px] font-normal tracking-[0.28em] text-black/60 uppercase mb-2">Your Message</label><textarea id="contact-message" required rows={4} value={form.message} onChange={set('message')} className={`${inputCls} resize-y min-h-[100px]`} /></div>
            </div>
            <div className="flex justify-between items-center mt-6 pt-6 border-t border-[rgba(10,22,40,0.10)] flex-wrap gap-4">
              <p className="text-[10px] text-black/60 tracking-[0.04em]">Replies within 24 hours</p>
              <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2.5 text-[10px] font-normal tracking-[0.28em] text-white bg-black px-[34px] py-4 border-none cursor-pointer uppercase relative overflow-hidden group transition-all duration-400 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(10,22,40,0.18)] disabled:cursor-not-allowed disabled:opacity-70">
                <span className="absolute inset-0 bg-black z-0 translate-y-full group-hover:translate-y-0 transition-transform duration-[450ms] ease-[cubic-bezier(0.77,0,0.18,1)]" />
                <span className="relative z-10">{isSubmitting ? 'Sending Message...' : 'Send Message'}</span>
              </button>
            </div>
          </form>
        </div>
      </RevealDiv>
    </section>
  );
}
