'use client';

import type { ReactNode } from 'react';

type AuthShellProps = {
  eyebrow: string
  title: string
  description: string
  asideTitle: string
  asideBody: string
  asidePoints: string[]
  children: ReactNode
};

const authImage = '/produc page svgs/login page image/WhatsApp Image 2026-09-19 at 6.12.16 PM.jpeg';

export default function AuthShell({ asideTitle, asideBody, asidePoints, children }: AuthShellProps) {
  return (
    <section className="bg-white">
      <div className="grid min-h-dvh md:grid-cols-[minmax(0,52.25%)_minmax(390px,47.75%)]">
        <div className="relative min-h-[42dvh] overflow-hidden border-b border-[var(--theme-border)] md:min-h-dvh md:border-b-0 md:border-r">
          <img src={authImage} alt="House of Diams jewelry" className="absolute inset-0 h-full w-full object-cover object-center" />
        </div>
        <div className="flex min-h-[58dvh] items-center justify-center px-5 py-10 sm:px-8 md:min-h-dvh lg:px-12">
          <div className="w-full max-w-[390px]">
            {children}
            <div className="mt-8 border border-[var(--theme-border)] p-4 sm:p-5">
              <h2 className="font-primary-display text-[18px] font-medium leading-tight text-[var(--theme-ink)]">{asideTitle}</h2>
              <p className="mt-2 font-secondary text-[12px] leading-5 text-[var(--theme-muted)]">{asideBody}</p>
              <div className="mt-4 grid gap-2.5">
                {asidePoints.map((point) => (
                  <div key={point} className="flex items-center gap-2.5 font-secondary text-[12px] text-[var(--theme-ink)]">
                    <span className="h-1.5 w-1.5 border border-[var(--theme-ink)]" />{point}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}