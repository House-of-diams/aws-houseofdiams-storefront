// Rules for whether a category, subcategory or option listing page should be offered to search engines.
// Pure functions (no database), so they can be tested on their own.

/**
 * A listing with no products ("No pieces match") is a thin page; an editor can also hide any page.
 * When the product count could not be read, the page stays indexable: a database hiccup must never remove pages.
 */
export function shouldIndexListing(input: { seoIndexable?: boolean | null; totalCount?: number | null }) {
  if (input.seoIndexable === false) return false
  const count = input.totalCount
  return !(typeof count === 'number' && Number.isInteger(count) && count === 0)
}

/**
 * Keeps the entries that are not known to be empty, in their original order. `countOf` returns the product count,
 * or null when unknown (kept). At most `limit` lookups run at once, and a lookup that throws counts as unknown.
 */
export async function filterNonEmpty<T>(entries: readonly T[], countOf: (entry: T) => Promise<number | null>, limit = 4): Promise<T[]> {
  const counts: Array<number | null> = new Array(entries.length).fill(null)
  let next = 0
  async function worker() {
    while (next < entries.length) {
      const index = next++
      try { counts[index] = await countOf(entries[index]) } catch { counts[index] = null }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, entries.length)) }, worker))
  return entries.filter((_, index) => shouldIndexListing({ totalCount: counts[index] }))
}
