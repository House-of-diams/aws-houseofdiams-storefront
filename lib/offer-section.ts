// Copy for the "Exclusive offer" section above the footer. Editable in the admin
// (CMS > Home > Offer Section); these defaults are used until that table has a row,
// so the section keeps working before and after the database update.
export type OfferSectionContent = {
  isEnabled: boolean
  label: string
  heading: string
  giftHeading: string
  description: string
  buttonText: string
}

export const DEFAULT_OFFER_SECTION: OfferSectionContent = {
  isEnabled: true,
  label: 'Exclusive offer',
  heading: 'Get {offer} Off',
  giftHeading: 'Free Gift on Orders Over {minimum}',
  description: '',
  buttonText: 'Get Your Coupon Code',
}

type Row = Partial<Record<'is_enabled' | 'label' | 'heading' | 'gift_heading' | 'description' | 'button_text', unknown>> | null

const text = (value: unknown, fallback: string) => (typeof value === 'string' && value.trim() ? value.trim() : fallback)

export function offerSectionFromRow(row: Row): OfferSectionContent {
  if (!row) return DEFAULT_OFFER_SECTION
  return {
    isEnabled: row.is_enabled !== false,
    label: text(row.label, DEFAULT_OFFER_SECTION.label),
    heading: text(row.heading, DEFAULT_OFFER_SECTION.heading),
    giftHeading: text(row.gift_heading, DEFAULT_OFFER_SECTION.giftHeading),
    description: typeof row.description === 'string' ? row.description.trim() : '',
    buttonText: text(row.button_text, DEFAULT_OFFER_SECTION.buttonText),
  }
}

/** Replaces {offer} / {minimum} in an admin-written heading. Unknown tokens are left as typed. */
export function fillOfferTokens(template: string, values: { offer?: string; minimum?: string }) {
  return template
    .replaceAll('{offer}', values.offer ?? '')
    .replaceAll('{minimum}', values.minimum ?? '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
