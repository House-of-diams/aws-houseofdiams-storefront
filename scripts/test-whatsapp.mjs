import assert from 'node:assert/strict'
import test from 'node:test'
import { FALLBACK_WHATSAPP_NUMBER, normalizeWhatsappNumber, whatsappNumberOrFallback } from '../lib/whatsapp.ts'

test('a country code alone is not a recipient', () => {
  assert.equal(normalizeWhatsappNumber('91'), '')
  assert.equal(normalizeWhatsappNumber('+91 '), '')
  assert.equal(whatsappNumberOrFallback('91'), FALLBACK_WHATSAPP_NUMBER)
})
test('real numbers are kept as digits only', () => {
  assert.equal(normalizeWhatsappNumber('+91 93285 36178'), '919328536178')
  assert.equal(normalizeWhatsappNumber('919328536178'), '919328536178')
})
test('junk, empty and too-long values fall back', () => {
  for (const value of [undefined, null, 123456789012, '', 'abc', '1234567', '1'.repeat(16)]) assert.equal(normalizeWhatsappNumber(value), '')
})
