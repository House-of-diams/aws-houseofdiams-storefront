// In-memory product search: ranked, typo-tolerant and synonym-aware.
// Pure functions only; caching of the index lives in catalog-products.ts.

export type ProductSearchResult = {
  dbId: string
  slug: string
  name: string
  shortMeta: string
  imageUrl: string
  priceFrom: number
  mainCategorySlug: string
  mainCategoryName: string
}

export type ProductSearchDoc = ProductSearchResult & {
  featured: boolean
  normalizedName: string
  // Each searchable word with the weight of the most important field it came from.
  terms: Array<[word: string, weight: number]>
}

export type ProductSearchField = { weight: number; values: Array<string | null | undefined> }

export const SEARCH_FIELD_WEIGHTS = {
  name: 10,
  option: 6,
  subcategory: 6,
  category: 5,
  style: 4,
  shape: 4,
  metal: 3,
  certificate: 3,
  attribute: 2,
} as const

const STOP_WORDS = new Set(['a', 'an', 'and', 'the', 'for', 'with', 'in', 'of', 'to', 'by', 'on', 'my', 'me'])

// Customer wording -> catalogue wording. Values are tried with a small penalty.
const SYNONYMS: Record<string, string[]> = {
  ring: ['band'],
  band: ['ring'],
  wedding: ['band', 'eternity'],
  earring: ['stud', 'hoop', 'drop'],
  stud: ['earring'],
  hoop: ['earring'],
  necklace: ['pendant', 'chain'],
  pendant: ['necklace'],
  chain: ['necklace'],
  bracelet: ['bangle', 'tennis'],
  bangle: ['bracelet'],
  lab: ['labgrown'],
  grown: ['labgrown'],
}

const SYNONYM_FACTOR = 0.85
const EXACT_SCORE = 1
const PREFIX_SCORE = 0.8
const TYPO_SCORE = 0.6

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Light English stemming so "rings", "earrings", "diamonds" match their singular.
function stem(word: string) {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.length > 4 && /(ches|shes|xes|ses)$/.test(word)) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

function toWords(value: string) {
  return normalizeSearchText(value).split(' ').filter(Boolean).map(stem)
}

export function tokenizeSearchQuery(query: string) {
  return toWords(query).filter((word) => !STOP_WORDS.has(word)).slice(0, 6)
}

export function buildProductSearchDoc(result: ProductSearchResult, featured: boolean, fields: ProductSearchField[]): ProductSearchDoc {
  const weights = new Map<string, number>()
  for (const field of fields) {
    for (const value of field.values) {
      if (!value) continue
      const words = toWords(value)
      // Also index joined forms so "lab grown" matches "labgrown" and "18 k" matches "18k".
      if (words.length > 1) words.push(words.join(''))
      for (const word of words) weights.set(word, Math.max(weights.get(word) ?? 0, field.weight))
    }
  }
  return { ...result, featured, normalizedName: ` ${toWords(result.name).join(' ')} `, terms: [...weights] }
}

// Edit distance capped at `max`; returns max + 1 once the cap is exceeded.
function boundedEditDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
      rowMin = Math.min(rowMin, current[j])
    }
    if (rowMin > max) return max + 1
    previous = current
  }
  return previous[b.length]
}

function allowedTypos(token: string) {
  if (token.length >= 8) return 2
  if (token.length >= 4) return 1
  return 0
}

function wordMatchScore(token: string, word: string) {
  if (word === token) return EXACT_SCORE
  if (token.length >= 2 && word.startsWith(token)) return PREFIX_SCORE
  const typos = allowedTypos(token)
  if (!typos) return 0
  if (boundedEditDistance(token, word, typos) <= typos) return TYPO_SCORE
  // Typo inside a partially typed word, e.g. "solitai" vs "solitaire".
  if (word.length > token.length && boundedEditDistance(token, word.slice(0, token.length), typos) <= typos) return TYPO_SCORE * PREFIX_SCORE
  return 0
}

// Distinct words across the catalogue, computed once per index.
const vocabularyByDocs = new WeakMap<ProductSearchDoc[], string[]>()

function getVocabulary(docs: ProductSearchDoc[]) {
  let vocabulary = vocabularyByDocs.get(docs)
  if (!vocabulary) {
    vocabulary = [...new Set(docs.flatMap((doc) => doc.terms.map(([word]) => word)))]
    vocabularyByDocs.set(docs, vocabulary)
  }
  return vocabulary
}

// Scores a query token against each distinct catalogue word once, so the
// per-product pass is only cheap map lookups.
function scoreTokenAgainstVocabulary(token: string, vocabulary: string[]) {
  const variants: Array<[string, number]> = [[token, 1], ...(SYNONYMS[token] ?? []).map((synonym): [string, number] => [stem(synonym), SYNONYM_FACTOR])]
  const scores = new Map<string, number>()
  for (const word of vocabulary) {
    let best = 0
    for (const [variant, factor] of variants) best = Math.max(best, wordMatchScore(variant, word) * factor)
    if (best) scores.set(word, best)
  }
  return scores
}

function tokenScore(doc: ProductSearchDoc, wordScores: Map<string, number>) {
  let best = 0
  for (const [word, weight] of doc.terms) {
    const score = wordScores.get(word)
    if (score) best = Math.max(best, score * weight)
  }
  return best
}

/**
 * Ranks products for a query. Products must match every word; when nothing
 * does, the best partial matches are returned so customers never hit a dead end.
 */
export function searchProductDocs(docs: ProductSearchDoc[], query: string, limit: number): ProductSearchResult[] {
  const tokens = tokenizeSearchQuery(query)
  if (!tokens.length) return []
  // Whole-word phrase match only, so "rings" does not boost "earrings".
  const queryPhrase = ` ${tokens.join(' ')} `
  const vocabulary = getVocabulary(docs)
  const tokenWordScores = tokens.map((token) => scoreTokenAgainstVocabulary(token, vocabulary))

  const scored = docs.map((doc) => {
    const scores = tokenWordScores.map((wordScores) => tokenScore(doc, wordScores))
    const matched = scores.filter(Boolean).length
    let score = scores.reduce((sum, value) => sum + value, 0)
    if (doc.normalizedName.includes(queryPhrase)) score += 8
    if (doc.featured) score += 0.5
    return { doc, score, matched }
  })

  const complete = scored.filter((entry) => entry.matched === tokens.length)
  const pool = complete.length || tokens.length === 1
    ? complete
    : scored.filter((entry) => entry.matched >= Math.ceil(tokens.length / 2))

  return pool
    .sort((a, b) => b.matched - a.matched || b.score - a.score || a.doc.name.localeCompare(b.doc.name))
    .slice(0, limit)
    .map(({ doc }) => ({
      dbId: doc.dbId,
      slug: doc.slug,
      name: doc.name,
      shortMeta: doc.shortMeta,
      imageUrl: doc.imageUrl,
      priceFrom: doc.priceFrom,
      mainCategorySlug: doc.mainCategorySlug,
      mainCategoryName: doc.mainCategoryName,
    }))
}
