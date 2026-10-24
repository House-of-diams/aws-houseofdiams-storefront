export type BlogPost = {
  id: number
  slug: string
  title: string
  excerpt: string
  category: string
  bgColor: string
  date: string
  readTime: string
  tags: string[]
  body: string[]
}

export const blogPosts: BlogPost[] = [
  {
    id: 1,
    slug: 'how-to-choose-a-diamond-shape',
    title: 'How to Choose a <em>Diamond Shape</em> That Fits Your Style',
    excerpt: 'A quick guide to balancing personality, hand feel, and timelessness when choosing a diamond shape.',
    category: 'Guides',
    bgColor: 'linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #c9a44c 100%)',
    date: 'April 23, 2026',
    readTime: '4 min read',
    tags: ['Diamond', 'Guide', 'Shape'],
    body: [
      'Round, oval, emerald, and pear all create very different moods. The best choice usually comes down to the proportions you love wearing every day.',
      'When comparing shapes, look at more than sparkle alone. Finger coverage, setting style, and how modern or classic the silhouette feels all matter.',
    ],
  },
  {
    id: 2,
    slug: 'natural-vs-cvd-diamonds',
    title: 'Natural vs <em>Lab-Grown Diamonds</em>: What Actually Matters?',
    excerpt: 'Understanding visual beauty, budget, and long-term expectations when comparing natural and lab-grown diamonds.',
    category: 'Education',
    bgColor: 'linear-gradient(135deg, #1f2937 0%, #334155 40%, #d6ba74 100%)',
    date: 'April 20, 2026',
    readTime: '5 min read',
    tags: ['Lab-Grown', 'Natural', 'Education'],
    body: [
      'Both natural and lab-grown diamonds can be stunning. The right choice depends on your priorities around rarity, value, and size within budget.',
      'A good buying process should focus on cut quality and transparency first, then help you compare origin and certification with confidence.',
    ],
  },
  {
    id: 3,
    slug: 'behind-a-bespoke-ring',
    title: 'Behind a <em>Bespoke Ring</em>: From Sketch to Final Polish',
    excerpt: 'A look inside the custom process, from concept conversations to the final handcrafted finish.',
    category: 'Bespoke',
    bgColor: 'linear-gradient(135deg, #0A1628827 0%, #3f3f46 45%, #b8922a 100%)',
    date: 'April 16, 2026',
    readTime: '3 min read',
    tags: ['Bespoke', 'Craft', 'Process'],
    body: [
      'Custom jewelry starts with clarity: what should the piece feel like, not just how should it look. That shapes every design decision after.',
      'Sketches, stone selection, CAD refinement, and finishing all work together to turn an idea into something deeply personal.',
    ],
  },
  {
    id: 4,
    slug: 'care-tips-for-fine-jewellery',
    title: '<em>Care Tips</em> for Fine Jewelry You Wear Every Day',
    excerpt: 'Simple habits that help your rings, pendants, and bracelets keep their shine longer.',
    category: 'Care',
    bgColor: 'linear-gradient(135deg, #172554 0%, #1d4ed8 40%, #d4a840 100%)',
    date: 'April 12, 2026',
    readTime: '4 min read',
    tags: ['Care', 'Maintenance', 'Jewelry'],
    body: [
      'Daily wear pieces benefit from regular gentle cleaning and thoughtful storage. Small habits prevent dullness and avoidable damage.',
      'Professional checks are still valuable, especially for prongs and settings that protect your center stone over time.',
    ],
  },
  {
    id: 5,
    slug: 'styling-layered-diamond-jewellery',
    title: 'Styling <em>Layered Diamond Jewelry</em> Without Overdoing It',
    excerpt: 'A simple framework for stacking pieces so the final look feels intentional and elevated.',
    category: 'Style',
    bgColor: 'linear-gradient(135deg, #1c1917 0%, #44403c 45%, #e7c873 100%)',
    date: 'April 8, 2026',
    readTime: '3 min read',
    tags: ['Style', 'Layering', 'Diamond'],
    body: [
      'The cleanest layered looks usually begin with one anchor piece, then build with contrast in scale rather than noise.',
      'Leave a little breathing room between textures, lengths, and silhouettes so every piece still gets to speak.',
    ],
  },
]
