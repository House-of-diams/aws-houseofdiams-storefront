import EducationPostPage from '@/components/pages/EducationPostPage'
import JsonLd from '@/components/seo/JsonLd'
import type { BlogPost } from '@/lib/data/blog-posts'
import { getStorageImageUrl } from '@/lib/data/blog-posts'
import { educationHubPath, educationPostPath, postsInHub, type EducationHub } from '@/lib/education-hubs'
import { createBlogPostingSchema, createBreadcrumbSchema } from '@/lib/structured-data'

/** One education article with its structured data. The address and breadcrumb include the hub when it has one. */
export default function EducationArticleView({ post, hub, hubs, summaries }: { post: BlogPost; hub: EducationHub | null; hubs: EducationHub[]; summaries: BlogPost[] }) {
  const path = educationPostPath(post, hubs)
  const others = summaries.filter((entry) => entry.id !== post.id)
  // Same-hub articles first, then the rest, three in all.
  const sameHub = hub ? postsInHub(others, hub) : []
  const related = [...sameHub, ...others.filter((entry) => !sameHub.includes(entry))].slice(0, 3)
  return (
    <>
      <JsonLd data={createBlogPostingSchema(post, getStorageImageUrl(post.heroImagePath), path)} />
      <JsonLd data={createBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Education', path: '/education' },
        ...(hub ? [{ name: hub.name, path: educationHubPath(hub) }] : []),
        { name: post.titleRaw, path },
      ])} />
      <EducationPostPage post={post} relatedPosts={related} />
    </>
  )
}
