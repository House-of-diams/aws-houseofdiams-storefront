'use client';
import DataNotice from '@/components/consent/DataNotice'

import { useState } from 'react';
import { cinzelFont } from '@/app/fonts';

interface NewsletterProps {
  onToast?: (msg: string) => void;
}

export default function Newsletter({ onToast }: NewsletterProps) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);

    try {
      const response = await fetch('/api/public/newsletter/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Unable to subscribe right now.');
      }

      setEmail('');
      onToast?.('WELCOME TO HOUSE OF DIAMS');
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Unable to subscribe right now.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="reveal mx-auto mb-[110px] w-[95vw] max-w-[calc(100%-24px)] border border-[var(--theme-border-strong)] px-5 py-14 text-center sm:w-auto sm:max-w-none sm:px-[52px] sm:py-[90px]"
      style={{
        background: 'linear-gradient(135deg, var(--theme-surface-soft) 0%, var(--bg2) 100%)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--sans)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 20% 20%, rgba(10,22,40,0.1), transparent 40%), radial-gradient(circle at 80% 80%, rgba(10,22,40,0.08), transparent 40%)',
          pointerEvents: 'none',
        }}
      />

      <div className="relative z-[1] mx-auto max-w-[560px]">
        <div
          style={{
            fontSize: '10px',
            fontWeight: 400,
            letterSpacing: '0.32em',
            color: 'var(--theme-ink)',
            textTransform: 'uppercase',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <span style={{ width: '24px', height: '1px', background: 'var(--theme-ink)', display: 'inline-block' }} />
          The Inner Circle
        </div>

        <h3
          className={`${cinzelFont.variable} font-primary-display section-title`}
          style={{
            fontSize: 'clamp(30px, 8vw, 52px)',
            fontWeight: 300,
            color: 'var(--ink)',
            marginBottom: '16px',
            letterSpacing: '0.01em',
            lineHeight: 1.1,
          }}
        >
          Receive{' '}
          <em style={{ fontStyle: 'normal', color: 'var(--theme-ink)' }}>New Drops First</em>
        </h3>

        <p
          style={{
            fontSize: '12px',
            fontWeight: 300,
            letterSpacing: '0.08em',
            color: 'var(--ink3)',
            marginBottom: '32px',
            lineHeight: 1.8,
          }}
        >
          Join our private list for exclusive previews, bespoke releases and jeweller&apos;s notes from the Surat workshop.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-[440px] flex-col overflow-hidden border border-[var(--border)] bg-white sm:flex-row"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            aria-label="Email address"
            className="min-h-[54px] flex-1 border-none bg-transparent px-5 text-[12px] text-[var(--ink)] outline-none"
            style={{ fontFamily: 'var(--sans)' }}
          />
          <button
            type="submit"
            disabled={submitting}
            className="min-h-[54px] border-none bg-[var(--ink)] px-6 text-[10px] uppercase tracking-[0.28em] text-[var(--bg)] transition sm:px-6"
            style={{ fontFamily: 'var(--sans)', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1 }}
            onMouseEnter={(e) => {
              if (!submitting) (e.currentTarget as HTMLElement).style.background = 'var(--theme-ink)';
            }}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--ink)')}
          >
            {submitting ? 'Joining...' : 'Subscribe'}
          </button>
        </form>
        <DataNotice tone="inherit" fields="email address" purpose="send you our newsletter (you can unsubscribe at any time)" className="mx-auto mt-3 max-w-[440px]" />
      </div>
    </section>
  );
}
