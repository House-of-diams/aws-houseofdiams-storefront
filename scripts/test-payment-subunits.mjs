import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { roundChargeAmount, toRazorpayAmountInSubunits } from '../lib/payment-subunits.ts'

test('converts two-decimal Razorpay currencies to integer subunits', () => {
  assert.equal(toRazorpayAmountInSubunits(685.42, 'USD'), 68542)
  assert.equal(toRazorpayAmountInSubunits(685.42, 'CAD'), 68542)
  assert.equal(toRazorpayAmountInSubunits(685.42, 'AED'), 68542)
  assert.equal(toRazorpayAmountInSubunits(685.42, 'INR'), 68542)
})

test('rounds JPY to whole yen and does not multiply it by one hundred', () => {
  assert.equal(roundChargeAmount(685.42, 'JPY'), 685)
  assert.equal(toRazorpayAmountInSubunits(685.42, 'JPY'), 685)
})

test('rejects invalid payment amounts and currencies', () => {
  assert.throws(() => toRazorpayAmountInSubunits(0, 'USD'))
  assert.throws(() => toRazorpayAmountInSubunits(Number.POSITIVE_INFINITY, 'USD'))
  assert.throws(() => toRazorpayAmountInSubunits(10, 'ZZZ'))
})

test('database finalization uses the same JPY subunit rule', () => {
  const migration = readFileSync(new URL('../supabase/migrations/202609280001_payment_currency_subunits.sql', import.meta.url), 'utf8')
  assert.match(migration, /when 'JPY' then round\(coalesce\(v_order\.payment_amount, 0\)\)::bigint/i)
})

test('F7 RDS patch changes only the verified JPY amount expression', () => {
  const forward = readFileSync(new URL('../docs/aws-f7-jpy-subunits-forward.sql', import.meta.url), 'utf8')
  const rollback = readFileSync(new URL('../docs/aws-f7-jpy-subunits-rollback.sql', import.meta.url), 'utf8')
  assert.match(forward, /when ''JPY'' then round\(coalesce\(v_order\.payment_amount, 0\)\)::bigint/i)
  assert.match(forward, /EXECUTE replace\(definition, old_line, new_line\)/)
  assert.match(rollback, /EXECUTE replace\(definition, new_line, old_line\)/)
  assert.match(forward, /pg_get_userbyid\(proowner\) = current_user/)
})

test('a delayed failed-payment event cannot overwrite a paid order', () => {
  const payments = readFileSync(new URL('../lib/repositories/payment-repository.ts', import.meta.url), 'utf8')
  assert.match(payments, /where id = \$1 and razorpay_order_id = \$2 and payment_gateway = 'razorpay' and payment_status = 'pending'/)
})

test('non-USD checkout cannot charge using an emergency FX fallback', () => {
  const exchangeRates = readFileSync(new URL('../lib/exchange-rates.ts', import.meta.url), 'utf8')
  assert.match(exchangeRates, /if \(currency !== 'USD' && exchange\.source !== 'fixer'\)/)
  assert.match(exchangeRates, /AbortSignal\.timeout\(FIXER_REQUEST_TIMEOUT_MS\)/)
})
