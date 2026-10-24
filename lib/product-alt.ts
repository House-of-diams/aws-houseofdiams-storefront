/**
 * Alt text for a product's pictures. Editors do not always fill it in, and the page then used a generic
 * "Jewelry product media". A blank entry now falls back to the product name (and "- view N" after the first
 * picture, so each picture is told apart).
 */
export function fillImageAlts(productName: string, imageUrls: readonly string[], alts: ReadonlyArray<unknown> | null | undefined): string[] {
  const name = productName.trim() || 'Jewelry'
  return imageUrls.map((_, index) => {
    const written = typeof alts?.[index] === 'string' ? (alts[index] as string).trim() : ''
    if (written) return written
    return index === 0 ? name : `${name} - view ${index + 1}`
  })
}
