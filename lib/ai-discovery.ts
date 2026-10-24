import { getPublishedBlogSummaries } from '@/lib/blog'
import { getStorefrontProductDiscoveryRows } from '@/lib/catalog-products'
import { getPublishedEducationHubs, getPublishedEducationSummaries } from '@/lib/education'
import { educationPostPath } from '@/lib/education-hubs'
import { getCanonicalUrl } from '@/lib/site-url'

function cleanText(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function link(path: string, label: string, description?: string | null) {
  const suffix = cleanText(description)
  return `- [${label}](${getCanonicalUrl(path).toString()})${suffix ? `: ${suffix}` : ''}`
}

const corePages = [
  ['/', 'House of Diams', 'Luxury diamond jewelry crafted in Surat, India.'],
  ['/shop', 'Shop', 'Browse the complete jewelry catalog.'],
  ['/collection', 'Collections', 'Curated House of Diams collections.'],
  ['/bespoke', 'Bespoke Jewelry', 'Custom jewelry design and manufacturing.'],
  ['/about', 'About', 'Company, craftsmanship, values, and founders.'],
  ['/shipping', 'Shipping', 'Shipping information and policies.'],
  ['/returns', 'Returns', 'Returns policy and guidance.'],
  ['/faq', 'Frequently Asked Questions', 'Common customer questions and answers.'],
] as const

export async function buildLlmsText(full = false) {
  const [products, blogPosts, educationPosts, educationHubs] = await Promise.all([
    getStorefrontProductDiscoveryRows(),
    getPublishedBlogSummaries(),
    getPublishedEducationSummaries(),
    getPublishedEducationHubs(),
  ])

  const lines = [
    '# House of Diams',
    '',
    '> House of Diams is a luxury diamond jewelry company based in Surat, India, offering fine jewelry, engagement rings, wedding bands, bespoke pieces, and jewelry education.',
    '',
    'Use canonical public URLs below. Prices and availability can change; verify current details on the linked product page. Private account, cart, checkout, wishlist, and API routes are intentionally excluded.',
    '',
    '## Primary pages',
    '',
    ...corePages.map(([path, label, description]) => link(path, label, description)),
    '',
    '## Product catalog',
    '',
    ...products.map((product) =>
      link(
        `/shop/${product.slug}`,
        product.name,
        full
          ? [product.description, product.tag_line].filter(Boolean).join(' — ')
          : product.tag_line
      )
    ),
    '',
    '## Jewelry education',
    '',
    ...educationPosts
      .filter((post) => post.slug && post.slug !== 'education-copy')
      .map((post) => link(educationPostPath(post, educationHubs), cleanText(post.title), full ? post.subtitle : null)),
    '',
    '## Journal',
    '',
    ...blogPosts
      .filter((post) => post.slug)
      .map((post) => link(`/blog/${post.slug}`, cleanText(post.title), full ? post.subtitle : null)),
    '',
    '## Policies',
    '',
    link('/privacy-policy', 'Privacy Policy'),
    link('/terms', 'Terms and Conditions'),
    '',
    '## Discovery',
    '',
    link('/sitemap.xml', 'XML Sitemap'),
    link('/robots.txt', 'Crawler Rules'),
  ]

  return `${lines.join('\n')}\n`
}
