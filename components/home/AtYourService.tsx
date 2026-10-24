'use client';

const SERVICE_ITEMS = [
  { label: 'Hallmarked Gold', src: '/HOD specs/18K_Hallmarked_Gold.svg' },
  { label: 'IGI Certified', src: '/HOD specs/IGI_Certified.svg' },
  { label: 'Lifetime Buyback', src: '/HOD specs/Lifetime_Buyback.svg' },
  { label: 'Secure Shipping', src: '/HOD specs/Secure_Shipping.svg' },
  { label: 'High Quality', src: '/HOD specs/High_Quality_diamond.svg' },
  { label: 'Free Annual Cleaning', src: '/HOD specs/Free_Annual_Cleaning.svg' },
];

export default function AtYourService() {
  return (
    <section aria-labelledby="at-your-service-heading" className="w-full border-y border-black/[0.06] bg-white px-[var(--space-4)] py-[var(--space-8)] sm:px-[var(--space-6)] sm:py-[var(--space-10)] lg:px-[var(--space-8)]">
      <h2 id="at-your-service-heading" className="text-center font-[family-name:var(--font-family-primary)] text-[clamp(1rem,4.2vw,1.3rem)] font-medium leading-tight text-black sm:text-[clamp(1.3rem,2.1vw,1.65rem)]">
        THE HOD EXPERIENCE
      </h2>
      <div className="mx-auto mt-[var(--space-8)] grid max-w-[1400px] grid-cols-3 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-8 lg:mt-[var(--space-10)] lg:grid-cols-6 lg:gap-x-6">
        {SERVICE_ITEMS.map((item) => (
          <div key={item.src} className="flex min-w-0 flex-col items-center text-center">
            <img src={item.src} alt="" className="h-11 w-11 object-contain sm:h-14 sm:w-14" loading="lazy" />
            {item.label ? <p className="mt-3 font-[family-name:var(--font-family-secondary)] text-[11px] leading-[1.35] text-black sm:text-[13px]">{item.label}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
