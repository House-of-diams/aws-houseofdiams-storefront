import Image from 'next/image';
import Link from 'next/link';
import { cinzelFont } from '@/app/fonts';

type ShapeItem = {
  id: string;
  name: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  href?: string | null;
};

const shapeItems: ShapeItem[] = [
  { id: 'pear', name: 'Pear', description: 'A romantic teardrop silhouette with graceful length and bright sparkle.', imageSrc: '/discover-shapes/pear.webp', imageAlt: 'Pear diamond shape', href: '/shop?shape=pear' },
  { id: 'oval', name: 'Oval', description: 'A graceful elongated silhouette with soft brilliance and elegant presence.', imageSrc: '/discover-shapes/oval.webp', imageAlt: 'Oval diamond shape', href: '/shop?shape=oval' },
  { id: 'round', name: 'Round', description: 'The classic shape with unmatched sparkle and timeless brilliance.', imageSrc: '/discover-shapes/round.webp', imageAlt: 'Round diamond shape', href: '/shop?shape=round' },
  { id: 'cushion', name: 'Cushion', description: 'A soft pillow-like cut that blends romance, fire, and a luxurious feel.', imageSrc: '/discover-shapes/cushion.webp', imageAlt: 'Cushion diamond shape', href: '/shop?shape=cushion' },
  { id: 'emerald', name: 'Emerald', description: 'A refined step-cut look with clean geometry and understated glamour.', imageSrc: '/discover-shapes/emerald.webp', imageAlt: 'Emerald diamond shape', href: '/shop?shape=emerald' },
  { id: 'marquise', name: 'Marquise', description: 'A dramatic elongated profile with pointed ends and regal character.', imageSrc: '/discover-shapes/marquise.webp', imageAlt: 'Marquise diamond shape', href: '/shop?shape=marquise' },
  { id: 'radiant', name: 'Radiant', description: 'A lively cut that combines crisp geometry with bright, energetic sparkle.', imageSrc: '/discover-shapes/radiant.webp', imageAlt: 'Radiant diamond shape', href: '/shop?shape=radiant' },
  { id: 'asscher', name: 'Asscher', description: 'A geometric vintage-style cut with mirrored steps and bold symmetry.', imageSrc: '/discover-shapes/asscher.webp', imageAlt: 'Asscher diamond shape', href: '/shop?shape=asscher' },
  { id: 'heart', name: 'Heart', description: 'A sentimental silhouette crafted to feel playful, bright, and expressive.', imageSrc: '/discover-shapes/heart.webp', imageAlt: 'Heart diamond shape', href: '/shop?shape=heart' },
  { id: 'princess', name: 'Princess', description: 'A crisp square cut that delivers sharp sparkle with a modern edge.', imageSrc: '/discover-shapes/princess.webp', imageAlt: 'Princess diamond shape', href: '/shop?shape=princess' },
];

type InitialShapeItem = {
  sort_order: number;
  title: string;
  description: string;
  image_path: string;
  image_alt?: string | null;
  href?: string | null;
};

const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

// A card with no link saved in the admin opens the shop filtered to that shape (like the built-in cards).
const shapeHref = (name: string) => `/shop?shape=${encodeURIComponent(name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))}`;

export default function DiscoverShapes({ initialItems = [] }: { initialItems?: InitialShapeItem[] }) {
  const items: ShapeItem[] = initialItems.length > 0
    ? initialItems
        .slice()
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((item, index) => ({
          id: `shape-${index + 1}`,
          name: item.title,
          description: item.description,
          imageSrc: item.image_path,
          imageAlt: item.image_alt || item.title,
          href: item.href || shapeHref(item.title),
        }))
    : shapeItems;

  return (
    <section
      className="section-rhythm overflow-hidden bg-[var(--color-brand-accent,#fff)] px-[var(--space-4)] sm:px-[var(--space-6)] lg:px-[var(--space-12)]"
      aria-labelledby="discover-shapes-heading"
    >
      <div className="mx-auto w-full max-w-[1440px]">
        <div className="text-center">
          <h2
            id="discover-shapes-heading"
            className={`${cinzelFont.variable} font-primary-display section-title text-[clamp(1.75rem,3vw,2.75rem)] font-normal leading-[1.08] tracking-[0.01em] text-[var(--color-brand-primary,#000)]`}
          >
            Discover Shapes
          </h2>
          <p className="mx-auto mt-[var(--space-3)] max-w-[36rem] font-[family-name:var(--font-family-secondary)] text-sm leading-[1.5] text-[var(--color-brand-primary,#000)]/70 md:text-base">
            {NUMBER_WORDS[items.length] ?? items.length} shapes. Each one cut differently. Pick what suits you.
          </p>
        </div>

        <div className="mt-[var(--space-section-block)] grid grid-cols-3 gap-x-[var(--space-3)] gap-y-[var(--space-6)] sm:grid-cols-4 md:grid-cols-5 md:gap-x-[var(--space-4)] lg:grid-cols-[repeat(auto-fit,minmax(4.75rem,1fr))] lg:gap-x-[var(--space-5)] lg:gap-y-0">
          {items.map((item) => {
            const content = (
              <>
                <span className="relative flex h-[3.75rem] w-[3.75rem] items-center justify-center sm:h-[4.25rem] sm:w-[4.25rem] lg:h-[4.75rem] lg:w-[4.75rem]">
                  <Image
                    src={item.imageSrc}
                    alt={item.imageAlt}
                    fill
                    sizes="(max-width: 639px) 60px, (max-width: 1023px) 68px, 76px"
                    className="object-contain"
                  />
                </span>
                <span className="mt-[var(--space-2)] max-w-full text-center font-[family-name:var(--font-family-secondary)] text-xs font-medium leading-[1.25] tracking-[0.01em] text-[var(--color-brand-primary,#000)] sm:text-[0.8125rem]">
                  {item.name}
                </span>
              </>
            );

            const className = "group flex min-w-0 flex-col items-center rounded-sm px-[var(--space-2)] py-[var(--space-2)] outline-none shadow-none transition-colors duration-200 ease-out hover:bg-[#E7E9EB] hover:shadow-none focus-visible:bg-[#E7E9EB] focus-visible:shadow-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary,#000)] motion-reduce:transition-none";

            return item.href ? (
              <Link key={item.id} href={item.href} className={className} aria-label={`Browse ${item.name}`}>
                {content}
              </Link>
            ) : (
              <div key={item.id} className={className}>
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
