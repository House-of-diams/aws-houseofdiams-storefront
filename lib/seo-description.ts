// Search engines cut descriptions at about 160 characters: shorten at a word boundary
// instead of letting them cut mid-sentence.
export function limitDescription(value: string, max = 160): string {
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, '') + '…'
}
