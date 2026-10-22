'use client';

export default function ProductMetalComposition({ composition, fallbackColor = '#D4AF37', compact = false }) {
  if (!composition) return null;

  const parts = (composition.parts ?? []).filter((part) => Number(part.percentage) > 0);
  const total = parts.reduce((sum, part) => sum + Number(part.percentage || 0), 0);
  const chartParts = total > 0 ? parts : [];
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <section className={compact ? 'mb-6 mt-2' : 'mb-10 mt-8'}>
      <div className={`grid items-stretch ${compact ? 'gap-4' : 'gap-6 lg:grid-cols-2'}`}>
        <div className={`${compact ? 'rounded-none border border-[rgba(10,22,40,0.08)] bg-[#FAFBFD]' : 'rounded-none bg-white shadow-[0_14px_32px_rgba(10,22,40,0.05)]'} h-full p-5`}>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#5F6878]">Metal</div>
          <div className="flex items-center gap-4">
            <div className="relative flex h-[112px] w-[112px] items-center justify-center rounded-full border border-[rgba(10,22,40,0.08)] bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.95),rgba(235,240,247,0.9)_45%,rgba(220,228,238,0.85)_100%)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_16px_28px_rgba(10,22,40,0.08)]">
              <svg viewBox="0 0 112 112" className="h-[92px] w-[92px] -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r={radius}
                  fill="none"
                  stroke="rgba(10,22,40,0.08)"
                  strokeWidth="16"
                />
                {chartParts.length > 0
                  ? chartParts.map((part, index) => {
                      const value = Number(part.percentage || 0);
                      const segment = (value / total) * circumference;
                      const offset = circumference - accumulated;
                      accumulated += segment;
                      return (
                        <circle
                          key={`${part.partName}-${index}`}
                          cx="56"
                          cy="56"
                          r={radius}
                          fill="none"
                          stroke={part.colorHex || fallbackColor}
                          strokeWidth="16"
                          strokeLinecap="butt"
                          strokeDasharray={`${segment} ${circumference - segment}`}
                          strokeDashoffset={offset}
                        />
                      );
                    })
                  : null}
              </svg>
              {!compact ? (
                <>
                  <span className="absolute inset-[26px] hidden rounded-full bg-white shadow-[inset_0_3px_8px_rgba(10,22,40,0.06)] sm:block" />
                  <span
                    className="absolute left-1/2 top-1/2 hidden h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[inset_0_6px_10px_rgba(255,255,255,0.45)] sm:block"
                    style={{ backgroundColor: fallbackColor }}
                  />
                </>
              ) : null}
            </div>
            <div>
              <div className="text-[30px] font-semibold leading-[1.1] text-[var(--color-brand-primary,#000000)]">{composition.name}</div>
              {composition.description ? <p className="mt-3 max-w-[36ch] text-[13px] leading-[1.8] text-[#292727]">{composition.description}</p> : null}
            </div>
          </div>
        </div>

        <div className={`${compact ? 'rounded-none border border-[rgba(10,22,40,0.08)] bg-white' : 'rounded-none bg-white shadow-[0_14px_32px_rgba(10,22,40,0.05)]'} h-full p-5`}>
          <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#5F6878]">Composition</div>
          <div className={compact ? 'grid grid-cols-2 gap-2' : 'space-y-3'}>
            {(composition.parts ?? []).map((part, index) => (
              <div key={`${part.partName}-${index}`} className="flex items-center justify-between gap-4 rounded-none border border-[rgba(10,22,40,0.08)] bg-[#FBFCFE] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`${compact ? 'h-3.5 w-3.5' : 'h-5 w-5'} inline-flex rounded-full border border-black/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)]`}
                    style={{ backgroundColor: part.colorHex || fallbackColor }}
                  />
                  <div className={`${compact ? 'text-[12px]' : 'text-[15px]'} font-medium text-[var(--color-brand-primary,#000000)]`}>{part.partName}</div>
                </div>
                <div className={`${compact ? 'text-[12px]' : 'text-[15px]'} font-semibold text-[var(--color-brand-primary,#000000)]`}>{part.percentage}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

