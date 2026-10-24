'use client';

import { Ruler } from 'lucide-react';

import { FindYourMatchQuiz } from '@/components/home/FindYourMatchQuiz';

/**
 * Product-page entry point for the shared Find Your Match quiz.
 * The dialog itself is owned by FindYourMatchQuiz so every entry point keeps
 * the same portal, focus management, escape handling, and scroll locking.
 */
export default function RingGuide() {
  return (
    <FindYourMatchQuiz
      triggerId="find-your-ring-size-trigger"
      renderTrigger={({ openQuiz, triggerId }) => (
        <button
          id={triggerId}
          type="button"
          onClick={openQuiz}
          className="mb-8 flex w-full items-center justify-between rounded-none border border-[rgba(0,0,0,0.10)] bg-white px-5 py-5 text-left transition hover:border-[rgba(0,0,0,0.18)] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        >
          <span className="flex items-center gap-4">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-none border border-[rgba(0,0,0,0.10)] bg-white text-black shadow-[0_10px_24px_rgba(0,0,0,0.06)]">
              <Ruler size={24} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span>
              <span className="block font-display-title text-[22px] leading-none text-[var(--color-brand-primary,#000000)]">Find your ring size</span>
              <span className="mt-2 block text-[11px] leading-[1.6] text-[var(--theme-muted,#6a6a6a)]">Get personalized guidance before you choose.</span>
            </span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-primary,#000000)]">Start</span>
        </button>
      )}
    />
  );
}
