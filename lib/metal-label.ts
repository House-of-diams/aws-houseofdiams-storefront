// Shared by product pages and checkout so an order shows exactly the label the shopper saw.
export function buildCombinedMetalLabel(args: {
  displayLabel?: string | null
  purityLabel?: string | null
  baseMetalName?: string | null
  name: string
}) {
  const purity = args.purityLabel?.trim()
  const baseMetal = args.baseMetalName?.trim() || args.name.trim()
  const displayLabel = args.displayLabel?.trim()
  const generatedLabel = (() => {
    if (!purity) return baseMetal

    const normalizedPurity = purity.toLowerCase()
    const normalizedBaseMetal = baseMetal.toLowerCase()
    return normalizedBaseMetal === normalizedPurity || normalizedBaseMetal.startsWith(`${normalizedPurity} `)
      ? baseMetal
      : `${purity} ${baseMetal}`.trim()
  })()

  if (displayLabel && displayLabel !== args.name.trim() && displayLabel !== baseMetal) {
    return displayLabel
  }
  return generatedLabel
}
