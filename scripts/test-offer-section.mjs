import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_OFFER_SECTION, fillOfferTokens, offerSectionFromRow } from '../lib/offer-section.ts'

test('no database row means the built-in copy', () => {
  assert.deepEqual(offerSectionFromRow(null), DEFAULT_OFFER_SECTION)
})
test('blank fields fall back, admin text wins', () => {
  const content = offerSectionFromRow({ is_enabled: true, label: '  Members only ', heading: '', gift_heading: 'Gift over {minimum}', description: '', button_text: 'Claim' })
  assert.equal(content.label, 'Members only')
  assert.equal(content.heading, DEFAULT_OFFER_SECTION.heading)
  assert.equal(content.giftHeading, 'Gift over {minimum}')
  assert.equal(content.buttonText, 'Claim')
})
test('the section can be switched off', () => {
  assert.equal(offerSectionFromRow({ is_enabled: false }).isEnabled, false)
})
test('tokens are replaced and extra spaces collapsed', () => {
  assert.equal(fillOfferTokens('Get {offer} Off', { offer: '10%' }), 'Get 10% Off')
  assert.equal(fillOfferTokens('Gift over {minimum}', { minimum: '$1,000' }), 'Gift over $1,000')
  assert.equal(fillOfferTokens('Save {offer} today', {}), 'Save today')
})
