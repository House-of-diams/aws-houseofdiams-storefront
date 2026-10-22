'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type MoreToExploreCategory = {
  name: string
  href: string
  imageUrl?: string | null
  imageAlt?: string | null
}

// Hip Hop was retired as a storefront section; never offer it as a destination.
const isRetiredSection = (category: MoreToExploreCategory) => /hip-?hop/i.test(category.name) || /hip-?hop/i.test(category.href)

export default function MoreToExplore({ categories: allCategories }: { categories: MoreToExploreCategory[] }) {
  const categories = allCategories.filter((category) => !isRetiredSection(category))
  const scrollerRef = useRef<HTMLDivElement>(null)
  if (!categories.length) return null

  const scroll = (direction: number) => {
    const scroller = scrollerRef.current
    if (!scroller) return
    scroller.scrollBy({ left: direction * Math.max(scroller.clientWidth * 0.72, 280), behavior: 'smooth' })
  }

  return (
    <section aria-labelledby="more-to-explore-heading" className="section-rhythm border-t border-[#e4e4e4] bg-(--color-white) px-4 sm:px-7">
      <div className="mx-auto max-w-6xl">
        <div className="mb-[var(--space-section-block)] flex items-end justify-between gap-4">
          <h2
            id="more-to-explore-heading"
            className="font-[family-name:var(--font-family-primary)] text-[16px] font-bold uppercase leading-[1.4] tracking-[0.06em] text-[#222222]"
          >
            More to Explore
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Previous categories"
              className="inline-flex h-10 w-10 items-center justify-center border border-black/20 bg-white text-black transition hover:border-black"
            >
              <ChevronLeft size={19} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Next categories"
              className="inline-flex h-10 w-10 items-center justify-center border border-black/20 bg-white text-black transition hover:border-black"
            >
              <ChevronRight size={19} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          aria-label="More to explore category carousel"
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-7 sm:px-7"
        >
          {categories.map((category) => (
            <Link
              key={`${category.name}-${category.href}`}
              href={category.href}
              className="group block w-[68vw] max-w-[300px] shrink-0 snap-start sm:w-[280px] lg:w-[300px]"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#F7F8FA]">
                {category.imageUrl ? (
                  <img
                    src={category.imageUrl}
                    alt={category.imageAlt || category.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : null}
              </div>
              <p className="mt-3 font-[family-name:var(--font-family-secondary)] text-[14px] font-medium text-[#222222] transition-colors group-hover:text-[#1c664b]">
                {category.name}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
