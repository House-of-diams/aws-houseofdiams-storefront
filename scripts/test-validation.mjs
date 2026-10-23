import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidEmail, isValidPhone, sanitizePhoneInput, toPaymentContact } from '../lib/validation.ts'

test('email validation rejects malformed addresses and accepts normal ones', () => {
  for (const ok of ['a@b.co', 'first.last+tag@gmail.com', 'user_name@sub.example.org']) assert.equal(isValidEmail(ok), true, ok)
  for (const bad of ['', 'plain', 'a@b', 'a@.com', '.a@b.com', 'a..b@c.com', 'a b@c.com', 'a@b..com', 'a@b.c', 'a@-b.com', 'a@b.com.', '@b.com']) assert.equal(isValidEmail(bad), false, bad)
  assert.equal(isValidEmail('a'.repeat(65) + '@b.com'), false)
})

test('phone input is a leading + and at most 15 digits', () => {
  assert.equal(sanitizePhoneInput('+91 98765-43210'), '+919876543210')
  assert.equal(sanitizePhoneInput('abc123def'), '123')
  assert.equal(sanitizePhoneInput('1234567890123456789'), '123456789012345')
  assert.equal(sanitizePhoneInput('98+76'), '9876')
})

test('phone validation needs 8 to 15 digits and nothing else', () => {
  for (const ok of ['+919876543210', '9876543210', '+1 (415) 555-0132', '12345678', '123456789012345']) assert.equal(isValidPhone(ok), true, ok)
  for (const bad of ['', '1234567', '1234567890123456', 'abcdefghij', '+91 98765 4321a', '98765*43210']) assert.equal(isValidPhone(bad), false, bad)
})

test('payment contact is +digits or empty', () => {
  assert.equal(toPaymentContact('+92 993928999'), '+92993928999')
  assert.equal(toPaymentContact('not a number'), '')
  assert.equal(toPaymentContact(null), '')
})
