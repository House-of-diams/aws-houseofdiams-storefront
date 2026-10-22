import assert from 'node:assert/strict'
import test from 'node:test'
import { limitDescription } from '../lib/seo-description.ts'

test('short descriptions are unchanged apart from whitespace', () => {
  assert.equal(limitDescription('  Fine   jewellery  '), 'Fine jewellery')
})
test('long descriptions end at a word within 160 characters', () => {
  const long = 'Cut colour clarity and carat decide how a diamond looks and what it costs. '.repeat(8)
  const result = limitDescription(long)
  assert.ok(result.length <= 160, String(result.length))
  assert.ok(result.endsWith('…'))
  assert.ok(!/\s…$/.test(result))
})
