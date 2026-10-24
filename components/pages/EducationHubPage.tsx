import Link from 'next/link'
import BlogListCard from '@/components/blog/BlogListCard'
import { seoCopyStyles } from '@/components/shop/CategorySeoCopy'
import type { BlogPost } from '@/lib/data/blog-posts'
import type { EducationHub } from '@/lib/education-hubs'
import { sanitizePageCopy } from '@/lib/sanitize-html'

/** An education hub: its heading, its introduction, and every published article filed under it (pillar first). */
export default function EducationHubPage({ hub, posts }: { hub: EducationHub; posts: BlogPost[] }) {
  const introHtml = hub.introHtml ? sanitizePageCopy(hub.introHtml).trim() : ''
  return (
    <div className="min-h-screen bg-white font-[family-name:var(--font-family-inter)] text-black">
      <section className="mx-auto max-w-[1100px] px-6 py-14">
        <nav aria-label="Breadcrumb" className="mb-6 font-secondary text-[12px] text-[#6a6a6a]">
          <Link href="/" className="underline-offset-2 hover:underline">Home</Link>
          <span aria-hidden="true"> / </span>
          <Link href="/education" className="underline-offset-2 hover:underline">Education</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{hub.name}</span>
        </nav>
        <h1 className="font-[family-name:var(--font-family-primary)] text-[clamp(28px,4vw,44px)] font-semibold leading-tight text-[#111]">{hub.seoH1 || hub.name}</h1>
        {introHtml ? <div className={`mt-6 max-w-3xl ${seoCopyStyles}`} dangerouslySetInnerHTML={{ __html: introHtml }} /> : null}
        {posts.length > 0 ? (
          <ul className="mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.id}>
                <BlogListCard post={post} basePath={`/education/${hub.slug}`} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-10 font-secondary text-[14px] text-[#6a6a6a]">Articles for this topic are coming soon.</p>
        )}
      </section>
    </div>
  )
}
