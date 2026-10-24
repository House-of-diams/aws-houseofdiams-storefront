'use client';

const trustItems = [
  {
    label: 'IGI & GIA Certified',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <polygon points="12,3 19,7 19,17 12,21 5,17 5,7" stroke="#FFFFFF" strokeWidth="1" />
        <path d="M9 12L11 14L15 10" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: '100% Conflict Free',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8" stroke="#FFFFFF" strokeWidth="1" />
        <path d="M12 7L13.5 10.5L17 11L14 13.5L15 17L12 15L9 17L10 13.5L7 11L10.5 10.5Z" stroke="#FFFFFF" strokeWidth=".8" />
      </svg>
    ),
  },
  {
    label: 'Luxury Packaging',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="7" width="18" height="14" rx="2" stroke="#FFFFFF" strokeWidth="1" />
        <path d="M8 7V5C8 3.3 9.3 2 11 2H13C14.7 2 16 3.3 16 5V7" stroke="#FFFFFF" strokeWidth="1" />
      </svg>
    ),
  },
  {
    label: 'Certified Lab-Grown Diamonds',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <polygon points="12,3 21,8 21,16 12,21 3,16 3,8" stroke="#FFFFFF" strokeWidth="1" />
      </svg>
    ),
  },
  {
    label: 'Worldwide Insured Shipping',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="6" width="20" height="14" rx="2" stroke="#FFFFFF" strokeWidth="1" />
        <path d="M2 10H22" stroke="#FFFFFF" strokeWidth="1" />
        <circle cx="7" cy="16" r="1.5" fill="#FFFFFF" />
        <circle cx="17" cy="16" r="1.5" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    label: 'Est. 2014 · Surat',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="#FFFFFF" strokeWidth="1" />
        <path d="M7 9H17M7 12H14M7 15H11" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function TrustStrip() {
  // Duplicate for seamless marquee
  const allItems = [...trustItems, ...trustItems];

  return (
    <div className="bg-[#0A1628] text-[#FFFFFF] py-[18px] overflow-hidden border-b border-[rgba(10,22,40,0.15)]">
      <div className="flex gap-[60px] animate-marquee w-max items-center">
        {allItems.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 whitespace-nowrap text-[10px] font-light tracking-[0.22em] uppercase"
          >
            <span className="flex-shrink-0 opacity-80">{item.icon}</span>
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
