'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Select } from '@/components/ui/select'
import { BlogPageHero } from '@/components/blog/BlogPageHero'
import type { BlogPageHero as BlogPageHeroData } from '@/lib/blog'
import { getStorageImageUrl, type BlogPost } from '@/lib/data/blog-posts'

function EducationCard({ post }: { post: BlogPost }) {
  const imageUrl = getStorageImageUrl(post.cardImagePath || post.heroImagePath)
  return (
    <article className="min-w-0 bg-white">
      <Link href={post.href ?? (post.slug ? `/education/${post.slug}` : '/education')} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111] focus-visible:ring-offset-4">
        <div className="relative aspect-[4/5] overflow-hidden bg-[#f1f1ef]">
          {imageUrl ? <Image src={imageUrl} alt={post.heroImageAlt || post.titleRaw} fill sizes="(max-width: 639px) 92vw, (max-width: 1023px) 46vw, 30vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : null}
        </div>
        <div className="pt-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-secondary text-[10px] font-semibold uppercase text-[#6a6a6a]">
            <span>{post.catalogCategory?.name || 'Education'}</span>
            {post.date ? <><span aria-hidden="true">·</span><time>{post.date}</time></> : null}
          </div>
          <h2 className="mt-2 font-secondary text-[15px] font-semibold leading-[1.35] text-[#111] sm:text-[16px]">{post.cardTitle || post.titleRaw}</h2>
          {post.subtitle ? <p className="mt-2 line-clamp-2 font-secondary text-[12px] leading-5 text-[#666]">{post.subtitle}</p> : null}
          <span className="mt-3 inline-flex border-b border-[#111] pb-0.5 font-secondary text-[10px] font-semibold uppercase text-[#111]">Read article</span>
        </div>
      </Link>
    </article>
  )
}

export default function EducationClient({ posts, hero }: { posts: BlogPost[]; hero?: BlogPageHeroData | null }) {
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('featured')
  const categories = useMemo(() => Array.from(new Map(posts.filter((post) => post.catalogCategory).map((post) => [post.catalogCategory!.slug, post.catalogCategory!])).values()), [posts])
  const visiblePosts = useMemo(() => {
    const filtered = category === 'all' ? posts : posts.filter((post) => post.catalogCategory?.slug === category)
    return [...filtered].sort((a, b) => {
      if (sort === 'title') return (a.cardTitle || a.titleRaw).localeCompare(b.cardTitle || b.titleRaw)
      if (sort === 'newest') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    })
  }, [category, posts, sort])

  const selectClasses = '!h-[42px] !rounded-none !border-black/15 !bg-white !px-4 !py-0 !font-[family-name:var(--font-family-montserrat)] !text-[11px] !font-semibold !uppercase !tracking-[0.08em] !text-[#0A1628] !shadow-none [&>span:last-child]:!h-auto [&>span:last-child]:!w-auto [&>span:last-child]:!rounded-none [&>span:last-child]:!border-0 [&>span:last-child]:!bg-transparent [&>span:last-child]:!text-[#0A1628]'
  const contentClasses = '!min-w-[238px] !rounded-none !border-black/10 !bg-white !shadow-[0_10px_26px_rgba(0,0,0,0.16)]'
  const itemClasses = '!rounded-none !bg-white !px-5 !py-3 !font-[family-name:var(--font-family-montserrat)] !text-[12px] !font-semibold !uppercase !tracking-[0.03em] !text-[#111] focus:!bg-[#F5F5F5] data-[state=checked]:!bg-[#F5F5F5] data-[state=checked]:!text-[#111]'

  return (
    <main className="min-h-screen bg-white text-[#111]">
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-20 pt-6 sm:px-7 sm:pt-8 lg:px-10 lg:pb-28">
        {hero ? <BlogPageHero hero={hero} /> : <div className="border-b border-[#d9d9d9] py-14"><h1 className="font-primary-display text-[clamp(34px,5vw,58px)] font-medium">Education</h1></div>}
        <section className="section-rhythm" aria-label="Education articles">
          <div className="sticky top-[calc(var(--hod-announcement-current-height,35px)+38px)] z-30 flex flex-col gap-3 border-y border-[#d8d8d8] bg-white/95 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:min-w-[230px] sm:max-w-[280px]"><Select value={category} onValueChange={setCategory} options={[{ value: 'all', label: 'All Categories' }, ...categories.map((item) => ({ value: item.slug, label: item.name }))]} validationLabel="Filter education by category" triggerLabel="Filter By" showItemIndicator={false} triggerClassName={selectClasses} contentClassName={contentClasses} itemClassName={itemClasses} /></div>
            <div className="w-full sm:min-w-[190px] sm:max-w-[230px]"><Select value={sort} onValueChange={setSort} options={[{ value: 'featured', label: 'Featured' }, { value: 'newest', label: 'Newest' }, { value: 'title', label: 'Title A-Z' }]} validationLabel="Sort education articles" triggerLabel="Sort By" showItemIndicator={false} contentAlign="end" triggerClassName={selectClasses} contentClassName={contentClasses} itemClassName={itemClasses} /></div>
          </div>
          {visiblePosts.length ? <div className="mt-[var(--space-section-block)] grid grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-7 lg:gap-y-14">{visiblePosts.map((post) => <EducationCard key={post.id} post={post} />)}</div> : <p className="py-20 text-center font-secondary text-sm text-[#666]">Educational articles will appear here when they are published.</p>}
        </section>
      </div>
    </main>
  )
}
