// components/product/SpecSection.jsx — House of Diams

/**
 * A single spec section with title + key-value rows.
 * @param {object}     props
 * @param {string}     props.title  - Section heading
 * @param {[string, string][]} props.rows  - Array of [label, value] pairs
 * @param {'piece'|'diamond'} [props.variant] - Icon variant
 * @param {boolean} [props.leftAlignValues] - Left align value column when content is prose/policy style
 */
export default function SpecSection({ title, rows, variant = 'piece', leftAlignValues = false, hideTitle = false }) {
  const icon =
    variant === 'diamond' ? (
      <svg className="w-[14px] h-[14px] flex-shrink-0" viewBox="0 0 14 14" fill="none">
        <polygon points="7,2 11,5 10,12 4,12 3,5" stroke="#0A1628" strokeWidth="1" fill="rgba(10,22,40,0.15)" />
      </svg>
    ) : (
      <svg className="w-[14px] h-[14px] flex-shrink-0" viewBox="0 0 14 14" fill="none">
        <rect x="2" y="4" width="10" height="7" stroke="#0A1628" strokeWidth="1" />
        <path d="M2 6H12" stroke="#0A1628" strokeWidth=".8" />
      </svg>
    );

  return (
    <div className="mb-10 last:mb-0">
      {hideTitle ? null : (
        <div className="mb-5 flex items-center gap-[10px] font-sans text-[18px] font-semibold tracking-[0.01em] text-[#0A1628] sm:text-[20px]">
          <span className="h-[14px] w-[14px] rounded-full bg-[#0A1628] opacity-20 flex-shrink-0" />
          {icon}
          {title}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map(([label, value], index) => (
          <div
            key={`${label}-${index}`}
            className="rounded-[18px] border border-[rgba(10,22,40,0.10)] bg-[#FAFBFD] p-5 shadow-[0_14px_34px_rgba(10,22,40,0.04)]"
          >
            <div className="mb-2 font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-[#5F6878]">
              {label}
            </div>
            <div
              className={`font-sans text-[18px] font-semibold leading-[1.3] text-[#0A1628] ${
                leftAlignValues ? 'text-left' : 'text-left'
              }`}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
