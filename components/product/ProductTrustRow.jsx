// components/product/ProductTrustRow.jsx — House of Diams

const TRUST_ITEMS = [
  {
    title: 'Overnight Shipping',
    sub: 'Worldwide',
    iconPath: '/produc page svgs/01-overnight-shipping.svg',
  },
  {
    title: 'Lifetime Warranty',
    sub: 'Included',
    iconPath: '/produc page svgs/02-lifetime-warranty.svg',
  },
  {
    title: '15 Days Return',
    sub: 'Free Return',
    iconPath: '/produc page svgs/03-15-days-free-return.svg',
  },
  {
    title: 'Certificate',
    sub: '& Appraisal',
    iconPath: '/produc page svgs/04-certificate-appraisal.svg',
  },
];

/**
 * Trust strip below the CTA buttons.
 */
export default function ProductTrustRow() {
  return (
    <div className="mb-4 grid grid-cols-4 gap-x-1.5 gap-y-3 bg-white py-2 sm:mb-5 sm:gap-6">
      {TRUST_ITEMS.map(({ title, iconPath }) => (
        <div key={title} className="text-center">
          <div className="flex justify-center">
            <img src={iconPath} alt={title} className="h-auto w-full max-w-[100px] object-contain sm:h-[100px] sm:w-[100px]" />
          </div>
        </div>
      ))}
    </div>
  );
}
