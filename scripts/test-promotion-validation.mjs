// Unit tests for promotion-form answer validation, which must agree with the checkout rules in lib/validation.ts.
import test from 'node:test'
import assert from 'node:assert/strict'
import { promotionAnswerError } from '../lib/promotion-validation.ts'

const q = (input_type, extra = {}) => ({ input_type, ...extra })

test('empty answers are left to the required-field check', () => {
  assert.equal(promotionAnswerError(q('email'), '   '), null)
})

test('email answers follow the shared email rule', () => {
  assert.equal(promotionAnswerError(q('email'), 'a@b.co'), null)
  for (const bad of ['a@b', 'a b@c.co', '@x.co', 'a@@x.co']) assert.ok(promotionAnswerError(q('email'), bad), bad)
  assert.equal(promotionAnswerError(q('email', { validation_message: 'Custom' }), 'nope'), 'Custom')
})

test('phone answers follow the shared 8–15 digit rule', () => {
  for (const ok of ['+91 98765 43210', '9876543210', '(022) 1234-5678', '+12345678']) assert.equal(promotionAnswerError(q('phone'), ok), null, ok)
  for (const bad of ['1234567', '1234567890123456', '+1234567890123456', 'abc12345678', '12345678x']) assert.ok(promotionAnswerError(q('phone'), bad), bad)
})

test('number answers must be finite numbers', () => {
  assert.equal(promotionAnswerError(q('number'), '12.5'), null)
  for (const bad of ['abc', 'Infinity', 'NaN']) assert.ok(promotionAnswerError(q('number'), bad), bad)
})

test('custom patterns apply; broken patterns do not block the customer', () => {
  assert.equal(promotionAnswerError(q('text', { validation_pattern: '^[A-Z]{3}$' }), 'ABC'), null)
  assert.ok(promotionAnswerError(q('text', { validation_pattern: '^[A-Z]{3}$' }), 'abc'))
  assert.equal(promotionAnswerError(q('text', { validation_pattern: '([' }), 'anything'), null)
})
