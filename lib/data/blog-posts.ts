import { mediaUrl } from '@/lib/media-url'

export interface BlogPost {
  id: number;
  slug?: string;
  category: string;
  date: string;
  readTime: string;
  author: string;
  bg: string;
  bgColor: string;
  title: string;
  titleRaw: string;
  cardTitle?: string;
  subtitle: string;
  tags: string[];
  body: string;
  heroImagePath?: string;
  cardImagePath?: string;
  heroImageAlt?: string;
  contentBlocks?: BlogPostContentBlock[];
  featuredProducts?: import('@/lib/catalog-products').StorefrontProduct[];
  isPublished?: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  catalogCategoryId?: string;
  catalogCategory?: { id: string; name: string; slug: string };
  seoTitle?: string;
  seoDescription?: string;
  seoIndexable?: boolean;
  publishedAt?: string;
}

export type BlogPostContentBlock = {
  id: string;
  type: 'text' | 'image' | 'heading' | 'quote';
  heading?: string;
  bodyHtml?: string;
  imagePath?: string;
  imageAlt?: string;
  imageCaption?: string;
};

export const bgColors: Record<string, string> = {
  "bg-0": "#EEF1F8",
  "bg-1": "#EDF3EE",
  "bg-2": "#F2EFF8",
  "bg-3": "#EDF2FA",
  "bg-4": "#EEF1F8",
};

export const posts: BlogPost[] = [
  {
    id: 0,
    slug: "cvd-vs-natural-diamonds",
    category: "Diamond Guide",
    date: "12 January 2025",
    readTime: "8 min read",
    author: "Krish Babariya",
    bg: "bg-0",
    bgColor: "#EEF1F8",
    titleRaw: "Lab-Grown vs Natural Diamonds — What Nobody Tells You",
    title: 'Lab-Grown vs Natural Diamonds — <em>What Nobody Tells You</em>',
    subtitle:
      "The industry wants you to believe they are different worlds. The truth is far more nuanced.",
    tags: ["Lab-Grown Diamonds", "Natural Diamonds", "Education", "Certification"],
    body: `<p>Walk into any jeweller and ask about lab-grown diamonds. Watch their expression. What you'll see is a carefully rehearsed response designed to steer you toward the more expensive option — because that's where the margin is.</p><p>The truth is that a lab-grown diamond and a natural diamond are, chemically and structurally, the same thing. Pure crystalline carbon arranged in a tetrahedral lattice. No gemologist on earth — looking at the stone alone, without instruments — can tell them apart.</p><h3>What Does Lab-Grown <em>Actually Mean?</em></h3><p>A diamond seed crystal is placed in a chamber. Hydrocarbon gas is introduced. The gas breaks down, and carbon atoms deposit on the seed crystal — layer by layer — growing a diamond over several weeks. The result is not a fake diamond. It is a real diamond, grown in a controlled environment rather than under the earth.</p><blockquote><p>"The only meaningful difference between a lab-grown and a natural diamond is where it was born — not what it is."</p><cite>Gemological Institute of America</cite></blockquote><h3>So Which Should <em>You Buy?</em></h3><p>If rarity matters to you — if the geological age of the stone is part of what you are buying — then a natural diamond carries meaning that no laboratory can replicate. If you want the largest, most brilliant stone for your budget, lab-grown gives you significantly more diamond for the same spend.</p><ul><li>Lab-grown diamonds are generally less expensive than equivalent natural diamonds</li><li>Both are graded by leading laboratories such as IGI and GIA</li><li>No visual difference is detectable by the human eye</li><li>Lab-grown diamonds are created in controlled conditions</li><li>Natural and lab-grown diamonds have different resale considerations</li></ul>`,
    heroImagePath: "",
    isPublished: true,
    sortOrder: 1,
  },
  {
    id: 1,
    slug: "surat-diamond-capital",
    category: "Craft",
    date: "28 February 2025",
    readTime: "6 min read",
    author: "Akshar Korat",
    bg: "bg-1",
    bgColor: "#EDF3EE",
    titleRaw: "How Surat Became the Diamond Capital of the World",
    title: 'How Surat Became the <em>Diamond Capital</em> of the World',
    subtitle:
      "Over 90% of the world's diamonds pass through this city. The story of how it happened.",
    tags: ["Surat", "Craftsmanship", "History", "India"],
    body: `<p>There is a city in Gujarat, India, where it is said that if you dropped a bucket of soil from anywhere on earth, a master craftsman could tell you the diamond-bearing geology within it. That city is Surat — and it has been the quiet engine of the global diamond trade for over six decades.</p><h3>How It <em>Began</em></h3><p>The story begins in the 1960s, when small rough stones — too small for Belgian or Israeli cutters to bother with — began arriving in Surat. Local craftsmen, working with hand tools and extraordinary patience, discovered they could cut these tiny stones profitably. Word spread. Capital arrived. Skills accumulated across generations.</p><blockquote><p>"A stone cut in Surat may travel to Antwerp, Geneva, Dubai, and Tokyo — and not one buyer will know it was born in Gujarat."</p><cite>Akshar Korat · House of Diams</cite></blockquote><p>House of Diams was born from this tradition. Our manufacturing partners carry decades of accumulated skill — families where the knowledge of diamond cutting has passed from grandfather to father to son.</p>`,
    heroImagePath: "",
    isPublished: true,
    sortOrder: 2,
  },
  {
    id: 2,
    slug: "the-4cs-decoded-simply",
    category: "Buying Guide",
    date: "15 March 2025",
    readTime: "5 min read",
    author: "Krish Babariya",
    bg: "bg-2",
    bgColor: "#F2EFF8",
    titleRaw: "The 4Cs — Decoded Simply",
    title: 'The 4Cs — <em>Decoded Simply</em>',
    subtitle:
      "Cut, colour, clarity, carat. Here is what they actually mean for a piece you'll wear every day.",
    tags: ["4Cs", "Buying Guide", "Education", "Diamonds"],
    body: `<p>The 4Cs have been the language of diamonds since the Gemological Institute of America standardised them in the 1940s. They are genuinely useful — but the way they are usually explained buries the practical insight beneath technical jargon.</p><h3>Cut — The One That <em>Matters Most</em></h3><p>Cut is the only one of the four Cs that is entirely in human hands. A poorly cut diamond of high colour and clarity will look dull. An excellent cut on a stone of lower colour and clarity will sparkle. If you are prioritising one of the four Cs above all others, prioritise cut. Always.</p><h3>Colour, Clarity & Carat</h3><p>G or H colour is our sweet spot recommendation — indistinguishable from D to the naked eye in most settings. Eye-clean clarity (VS2-SI1) is the practical standard. And remember: carat measures mass, not diameter. A well-cut 0.9ct stone can look larger than a poorly-cut 1.0ct stone.</p><ul><li>Prioritise cut above all other Cs</li><li>G-H colour is sweet spot for value vs appearance</li><li>Eye-clean clarity (VS2-SI1) is the practical standard</li><li>Carat is weight — a well-cut smaller stone can look larger</li><li>Always ask for certification — IGI or GIA minimum</li></ul>`,
    heroImagePath: "",
    isPublished: true,
    sortOrder: 3,
  },
  {
    id: 3,
    slug: "hip-hop-jewellery-culture-meets-craft",
    category: "Style",
    date: "02 April 2025",
    readTime: "7 min read",
    author: "Krish Babariya",
    bg: "bg-3",
    bgColor: "#EDF2FA",
    titleRaw: "Hip Hop Jewellery — Where Culture Meets Craft",
    title: 'Hip Hop Jewellery — <em>Where Culture Meets Craft</em>',
    subtitle:
      "From Biggie's chains to A$AP Rocky's layering — how hip hop transformed what diamonds mean.",
    tags: ["Hip Hop", "Culture", "Iced Out", "Custom"],
    body: `<p>Hip hop did not just borrow the language of luxury jewellery. It rewrote it. Where fine jewellery had always been about restraint — the single perfect stone, the whisper of platinum — hip hop made jewellery speak at full volume.</p><h3>The Grammar of <em>Ice</em></h3><p>The term "iced out" entered the culture somewhere in the mid-1990s. It described a piece so heavily set with diamonds that the underlying metal was barely visible. Cuban links. Baguette-set bezels. Pavé-covered surfaces. The aesthetic was maximalist by design.</p><blockquote><p>"In hip hop, a chain is not an accessory. It is a biography worn around your neck."</p><cite>Krish Babariya · House of Diams</cite></blockquote><p>At House of Diams, our hip hop division reflects this maturity. We craft both the fully iced Cuban link that announces its presence from across the room, and the single perfect pendant that rewards the person who leans in close enough to notice.</p>`,
    heroImagePath: "",
    isPublished: true,
    sortOrder: 4,
  },
  {
    id: 4,
    slug: "choosing-your-engagement-ring",
    category: "Guide",
    date: "18 April 2025",
    readTime: "6 min read",
    author: "Krish Babariya",
    bg: "bg-4",
    bgColor: "#EEF1F8",
    titleRaw: "Choosing Your Engagement Ring",
    title: 'Choosing Your <em>Engagement Ring</em>',
    subtitle:
      "The most important piece of jewellery you will ever buy deserves more than a rushed decision.",
    tags: ["Engagement", "Rings", "Guide", "Diamonds"],
    body: `<p>The most important piece of jewellery you will ever buy deserves more than a rushed decision made under a jeweller's deadline. This is our honest, pressure-free guide to choosing an engagement ring that will mean something for the rest of your life.</p><h3>Start with <em>the Setting</em></h3><p>The setting is the architecture of the ring — the metal, the prongs, the silhouette. It determines what kind of stone works best and how the ring looks on the hand. Solitaires are timeless. Halo settings make the centre stone appear larger. Pavé bands add brilliance without distracting from the main stone.</p><h3>The Stone <em>Shape</em></h3><p>Round brilliant remains the most popular cut globally because it maximises light return. Oval is the fastest-growing shape — it looks larger per carat than round and elongates the finger. Emerald cuts reward those who want to see into the stone rather than be dazzled by it. Each shape carries a personality. Choose the one that matches the person who will wear it.</p><ul><li>Round brilliant: most sparkle, most versatile</li><li>Oval: looks larger per carat, elongates the finger</li><li>Emerald: sophisticated, architectural, transparent</li><li>Cushion: romantic, vintage, soft-edged</li><li>Pear: dramatic, unique, must be oriented correctly</li></ul>`,
    heroImagePath: "",
    isPublished: true,
    sortOrder: 5,
  },
];

export function getStorageImageUrl(path?: string) {
  if (!path) return ''

  return mediaUrl(path)
}

export function mapBlogPostRecord(record: {
  id: number
  slug: string
  category: string
  author: string
  date_label: string
  read_time: string
  bg_key: string
  bg_color: string
  title: string
  title_html: string
  subtitle: string
  body_html: string
  hero_image_path?: string
  card_title?: string | null
  card_image_path?: string | null
  hero_image_alt?: string
  content_blocks?: Array<{
    id: number | string
    block_type: 'text' | 'image' | 'heading' | 'quote'
    heading?: string | null
    body_html?: string | null
    image_path?: string | null
    image_alt?: string | null
    image_caption?: string | null
  }>
  is_published?: boolean
  sort_order?: number
  tags?: string[]
  created_at?: string
  updated_at?: string
  catalog_category_id?: string | null
  catalog_category?: { id: string; name: string; slug: string } | Array<{ id: string; name: string; slug: string }> | null
  seo_title?: string | null
  seo_description?: string | null
  seo_indexable?: boolean | null
  published_at?: string | null
}): BlogPost {
  const catalogCategory = Array.isArray(record.catalog_category) ? record.catalog_category[0] : record.catalog_category
  return {
    id: record.id,
    slug: record.slug,
    category: record.category,
    date: record.date_label,
    readTime: record.read_time,
    author: record.author,
    bg: record.bg_key,
    bgColor: record.bg_color?.toLowerCase() === '#f5f0ea' ? '#EDF2FA' : record.bg_color,
    title: record.title_html || record.title,
    titleRaw: record.title,
    cardTitle: record.card_title?.trim() || record.title,
    subtitle: record.subtitle,
    tags: record.tags ?? [],
    body: record.body_html,
    heroImagePath: record.hero_image_path ?? '',
    cardImagePath: record.card_image_path?.trim() || record.hero_image_path || '',
    heroImageAlt: record.hero_image_alt?.trim() || record.title,
    contentBlocks: (record.content_blocks ?? []).map((block) => ({
      id: String(block.id),
      type: block.block_type,
      heading: block.heading ?? '',
      bodyHtml: block.body_html ?? '',
      imagePath: block.image_path ?? '',
      imageAlt: block.image_alt ?? '',
      imageCaption: block.image_caption ?? '',
    })),
    isPublished: record.is_published ?? true,
    sortOrder: record.sort_order ?? 0,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    catalogCategoryId: record.catalog_category_id ?? undefined,
    catalogCategory: catalogCategory ? { id: catalogCategory.id, name: catalogCategory.name, slug: catalogCategory.slug } : undefined,
    seoTitle: record.seo_title?.trim() || undefined,
    seoDescription: record.seo_description?.trim() || undefined,
    seoIndexable: record.seo_indexable !== false,
    publishedAt: record.published_at ?? undefined,
  }
}
