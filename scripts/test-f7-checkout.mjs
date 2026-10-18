import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { createRequire } from 'node:module'
import ts from 'typescript'

// No ENV files are loaded. Every external persistence/provider module must
// be supplied explicitly, so these tests cannot reach staging or Razorpay.
const nativeRequire = createRequire(import.meta.url)
function load(path, stubs = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const exports = {}
  new Function('require', 'exports', js)((name) => {
    if (name === 'server-only') return {}
    if (Object.hasOwn(stubs, name)) return stubs[name]
    if (name.startsWith('node:')) return nativeRequire(name)
    throw new Error(`Unmocked dependency: ${name}`)
  }, exports)
  return exports
}
const json = (body, options = {}) => Response.json(body, options)
const next = { NextResponse: { json } }
const customer = { kind: 'customer', id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'client@example.test' }
const guest = { kind: 'guest', hash: 'a'.repeat(64) }
const orderId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const order = { id: orderId, order_number: 'HOD-TEST', created_at: '2026-10-11T00:00:00Z',
  razorpay_order_id: 'order_fake', payment_amount: 112, payment_currency: 'USD', payment_status: 'pending',
  customer_first_name: 'Test', customer_last_name: 'Client', customer_email: customer.email,
  subtotal_amount: 100, gst_amount: 12, shipping_amount: 0, total_amount: 112,
  gateway_payload: { totals: { baseCurrency: 'USD', totalAmount: 112, exchangeRate: 1, chargedSubtotal: 100, chargedGst: 12 } } }
const flags = load('lib/f7-write-prepared.ts')
const enable = () => { process.env.HOD_CUSTOMER_AUTH_ENABLED = 'true'; process.env.HOD_F7_RDS_WRITE_PREPARED = 'true' }
const bodyRequest = (body, headers = {}) => new Request('https://store.test/api', { method: 'POST', headers,
  body: JSON.stringify(body) })
const queryResult = (rows = []) => ({ rows, rowCount: rows.length })

test('write gate is OFF by default and requires both server flags', () => {
  for (const [auth, write, expected] of [['', '', false], ['false', 'true', false], ['true', '', false], ['true', 'TRUE', false], ['true', 'true', true]]) {
    process.env.HOD_CUSTOMER_AUTH_ENABLED = auth; process.env.HOD_F7_RDS_WRITE_PREPARED = write
    assert.equal(flags.isF7WritePrepared(), expected)
    if (!expected) assert.throws(flags.requireF7WritePrepared)
  }
})

test('owner resolution rejects bearer identity, missing/expired/unverified cookies and never falls back from a bad cookie to guest', async () => {
  let identity = { ...customer, email_verified: true }
  const resolver = load('lib/f7-checkout-owner.ts', {
    '@/lib/customer-auth/oidc': { customerAuthCookieNames: () => ({ session: 'session' }), getCustomerSession: async () => identity },
    '@/lib/guest-checkout': load('lib/guest-checkout.ts'),
  }).resolveF7CheckoutOwner
  const request = (headers) => new Request('https://store.test/', { headers })
  assert.equal(await resolver(request({ authorization: 'Bearer legacy', cookie: 'session=good' })), null)
  assert.equal(await resolver(request({})), null)
  assert.deepEqual(await resolver(request({ cookie: 'session=good' })), customer)
  assert.equal((await resolver(request({ 'x-guest-checkout-token': 'a'.repeat(64) }))).kind, 'guest')
  for (const invalid of [null, { ...identity, email_verified: false }]) {
    identity = invalid
    assert.equal(await resolver(request({ cookie: 'session=expired', 'x-guest-checkout-token': 'a'.repeat(64) })), null)
  }
})

function pricingFixture(overrides = {}) {
  const product = { id: orderId, slug: 'ring', name: 'Ring', status: 'active', product_lane: 'standard',
    base_price: 100, stock_quantity: 0, gst_slab_id: 'gst', default_purity_price_id: null, ...overrides.product }
  const coupon = { id: 1, code: 'OFFER', is_active: true, reward_type: 'percentage', discount_type: 'percentage',
    discount_value: 10, minimum_order_amount: 0, usage_count: 0, usage_limit: 5, ...overrides.coupon }
  const repository = {
    loadCheckoutProductsFromRds: async () => [product], loadCheckoutVariantsFromRds: async () => overrides.variants || [],
    loadCheckoutPurityPricesFromRds: async () => overrides.purities || [], loadCheckoutSettingsFromRds: async () => ({ default_gst_slab_id: 'gst' }),
    loadCheckoutGstSlabsFromRds: async () => [{ id: 'gst', name: 'GST', percentage: 12 }], loadFallbackCheckoutGstSlabFromRds: async () => null,
    loadCheckoutCouponFromRds: async () => coupon, loadCheckoutGiftProductFromRds: async () => ({ ...product, id: 'gift', slug: 'gift', ...overrides.gift }),
    loadCheckoutGiftVariantFromRds: async () => overrides.giftVariant ?? null,
  }
  return load('lib/checkout-pricing.ts', { '@/lib/media-url': { mediaUrl: (value) => value || '' },
    '@/lib/repositories/checkout-pricing-repository': repository }).resolveAuthoritativeCheckoutPricing
}
const items = [{ slug: 'ring', name: 'Ring', quantity: 1 }]

test('RDS pricing permits zero-stock paid items and gifts, preserves percentage discount and post-discount GST', async () => {
  const pricing = pricingFixture()
  const result = await pricing({ rdsPreview: true, items, coupon: { id: 1, code: 'OFFER' } })
  assert.equal(result.data.subtotalAmount, 100); assert.equal(result.data.couponDiscountAmount, 10)
  assert.equal(result.data.gstAmount, 10.8); assert.equal(result.data.totalAmount, 100.8)
  const gifted = await pricingFixture({ coupon: { reward_type: 'free_gift', gift_product_id: 'gift' } })({ rdsPreview: true, items, coupon: { id: 1, code: 'OFFER' } })
  assert.equal(gifted.data.gift.slug, 'gift'); assert.equal(gifted.data.totalAmount, 112)
})

test('RDS pricing preserves fixed discount clamp, authoritative variant and purity prices', async () => {
  const fixed = await pricingFixture({ coupon: { reward_type: 'fixed', discount_type: 'fixed', discount_value: 1000 } })({ rdsPreview: true, items, coupon: { id: 1, code: 'OFFER' } })
  assert.equal(fixed.data.totalAmount, 0)
  const variants = [{ id: 'variant', product_id: orderId, price: 125 }]
  const selected = await pricingFixture({ variants })({ rdsPreview: true, items: [{ ...items[0], metalVariantId: 'variant', priceFrom: 1 }] })
  assert.equal(selected.data.lines[0].unitPrice, 125)
  const purity = await pricingFixture({ purities: [{ id: 'purity', product_id: orderId, purity_label: '18K', price: 140 }] })({ rdsPreview: true, items: [{ ...items[0], purity: '18K' }] })
  assert.equal(purity.data.lines[0].unitPrice, 140)
})

test('RDS pricing rejects inactive, unavailable, invalid quantities/configurations and coupon limits/dates', async () => {
  for (const product of [{ status: 'hidden' }, { product_lane: 'collection' }, { product_lane: 'hiphop', allow_checkout: false }, { base_price: 0 }]) {
    assert.equal((await pricingFixture({ product })({ rdsPreview: true, items })).status, 400)
  }
  for (const quantity of [0, -1, 1.5, 11]) assert.equal((await pricingFixture()({ rdsPreview: true, items: [{ ...items[0], quantity }] })).status, 400)
  assert.equal((await pricingFixture()({ rdsPreview: true, items: [{ ...items[0], metalVariantId: 'wrong' }] })).status, 400)
  for (const coupon of [{ is_active: false }, { usage_count: 5 }, { minimum_order_amount: 101 },
    { starts_at: '2099-01-01' }, { ends_at: '2000-01-01' }, { reward_type: 'free_gift', gift_product_id: null }]) {
    assert.equal((await pricingFixture({ coupon })({ rdsPreview: true, items, coupon: { id: 1, code: 'OFFER' } })).status, 400)
  }
})

const subunits = load('lib/payment-subunits.ts')
function checkoutFixture(options = {}) {
  enable()
  const calls = []
  const prepared = { normalizedItems: [{ entry: { ...items[0], priceFrom: 1 }, product: { id: orderId, sku: null }, quantity: 1,
    unitPrice: 100, subtotalAmount: 100, gstSlabId: 'gst', gstPercentage: 12, gstAmount: 12, gstLabel: 'GST', selectedCustomDropdowns: [] }],
    subtotalAmount: 100, gstAmount: 12, gstLabel: 'GST', gstPercentage: 12, couponId: null,
    couponCode: null, couponDiscountAmount: 0, couponRewardType: null, gift: null, totalAmount: 112,
    chargeQuote: { totalCharged: 112, chargeCurrency: 'USD', baseCurrency: 'USD', totalUsd: 112,
      exchangeRate: 1, exchangeRateSource: 'live' }, resolvedCustomer: { first_name: 'Test', last_name: 'Client',
      email: customer.email, phone: '+919876543210', country: 'India', state: 'Gujarat', city: 'Surat', postal_code: '395001',
      address_line_1: 'Test address', address_line_2: '', birth_date: '', anniversary_date: '', district: '' } }
  const domain = load('lib/checkout-order.ts', {
    '@/lib/email': { sendOrderConfirmationEmail: async () => {} }, '@/lib/exchange-rates': { buildCheckoutChargeQuote: async () => prepared.chargeQuote },
    '@/lib/checkout-pricing': { resolveAuthoritativeCheckoutPricing: pricingFixture() },
    '@/lib/validation': load('lib/validation.ts'), '@/lib/f7-write-prepared': flags,
    '@/lib/repositories/checkout-profile-repository': { loadCheckoutCustomerProfile: async () => null,
      loadCheckoutDropdownGroups: async () => options.groups || [], loadCheckoutDropdownOptions: async () => options.dropdownOptions || [] },
    '@/lib/repositories/checkout-repository': { createRdsPendingOrder: async (input) => { calls.push(['create-pending', input]);
      if (options.pendingError) throw new Error('private db detail'); return order } },
  })
  const handlers = load('lib/f7-checkout-handlers.ts', {
    'next/server': next, '@/lib/checkout-order': { ...domain, prepareCheckoutPayload: options.useRealPreparation ? domain.prepareCheckoutPayload
      : async () => options.pricingFailure || { data: prepared } },
    '@/lib/f7-checkout-owner': { resolveF7CheckoutOwner: async () => options.owner === null ? null : options.owner || customer },
    '@/lib/f7-write-prepared': flags, '@/lib/rate-limit': { enforceRateLimit: async () => ({ ok: true }) },
    '@/lib/db/errors': load('lib/db/errors.ts'), '@/lib/payment-subunits': subunits,
    '@/lib/razorpay': { getRazorpayKeyId: () => 'fake-key', isRazorpayConfigured: () => true,
      getRazorpayClient: () => ({ orders: { create: async (input) => { calls.push(['gateway-create', input]);
        if (options.gatewayFailure) throw new Error('provider private detail'); return { id: 'order_fake', ...input } },
      fetchPayments: async () => { if (options.fetchFailure) throw new Error('gateway down'); return { items: options.payments || [] } } } }),
      verifyRazorpayPaymentSignature: () => options.validSignature !== false,
      ensureRazorpayPaymentCaptured: async (input) => { calls.push(['capture', input]);
        if (options.captureFailure) throw new Error('mismatch'); return { id: 'pay_fake', amount: input.amountInSubunits, currency: input.currency, status: 'captured' } } },
    '@/lib/repositories/checkout-attempt-repository': {
      createCheckoutAttempt: async (...args) => { calls.push(['attempt', ...args]); if (options.duplicate) throw Object.assign(new Error('collision'), { code: '23505' }); return 'attempt_fake' },
      findCheckoutAttempt: async () => options.existing,
      completeCheckoutAttempt: async (...args) => { calls.push(['complete', ...args]); if (options.completionFailure) throw new Error('db down'); return true },
      failCheckoutAttempt: async (...args) => { calls.push(['fail', ...args]); return true },
    },
    '@/lib/repositories/checkout-repository': { findOwnedOrder: async (...args) => { calls.push(['owned', ...args]); return options.missingOrder ? null : { ...order, ...options.order } },
      cancelOwnedOrder: async (...args) => { calls.push(['cancel', ...args]); return true } },
    '@/lib/repositories/payment-repository': { failRdsPayment: async (...args) => calls.push(['payment-fail', ...args]) },
    '@/lib/f7-payment': { finalizeF7Payment: async (...args) => { calls.push(['finalize', ...args]); return options.finalization || { data: { orderId, orderNumber: 'HOD-TEST' } } },
      recoverF7CapturedPayment: async (...args) => { calls.push(['recover', ...args]); return options.recovery || { durable: true, status: 'refund_pending' } } },
    '@/lib/payment-recovery': { REFUNDABLE_FINALIZATION_ERRORS: new Set(['insufficient_stock', 'finalization_rpc_error']) },
  })
  return { handlers, calls, prepared, domain }
}

test('guest and customer placement preserve owner separation, made-to-order, totals, payload and gateway response', async () => {
  for (const owner of [customer, guest]) {
    const { handlers, calls } = checkoutFixture({ owner })
    const response = await handlers.handleF7Place(bodyRequest({ idempotencyKey: 'valid-attempt-key1' }))
    assert.equal(response.status, 200)
    const body = await response.json(); assert.equal(body.razorpay.amount, 11200)
    const input = calls.find(([name]) => name === 'create-pending')[1]
    assert.equal(input.order.fulfillment_mode, 'made_to_order'); assert.equal(input.order.user_id, null)
    assert.equal(input.order.customer_identity_id, owner.kind === 'customer' ? owner.id : null)
    assert.equal(input.order.guest_token_hash, owner.kind === 'guest' ? owner.hash : null)
    assert.equal(input.items[0].unit_price, 100)
  }
})

test('placement rejects missing owner/invalid key/live-FX failure before gateway orders or DB attempts', async () => {
  for (const [options, body, expected] of [[{ owner: null }, {}, 401], [{}, { idempotencyKey: 'bad' }, 400],
    [{ pricingFailure: { error: 'Live exchange pricing is temporarily unavailable.', status: 503 } }, { idempotencyKey: 'valid-attempt-key1' }, 503]]) {
    const { handlers, calls } = checkoutFixture(options)
    assert.equal((await handlers.handleF7Place(bodyRequest(body))).status, expected)
    assert.equal(calls.length, 0)
  }
})

test('real preparation validates required customer/custom selections and stores only authoritative prices', async () => {
  const { domain } = checkoutFixture()
  const result = await domain.prepareCheckoutPayload({ rdsPreview: true, customerIdentity: customer,
    payload: { items, customer: checkoutFixture().prepared.resolvedCustomer } })
  assert.equal(result.data.normalizedItems[0].unitPrice, 100)
  assert.equal((await domain.prepareCheckoutPayload({ rdsPreview: true, payload: { items } })).status, 400)
  assert.equal((await domain.prepareCheckoutPayload({ rdsPreview: true, payload: { items: [{ ...items[0], customSelections: [{ dropdownId: 'unowned', optionId: 'option' }] }],
    customer: checkoutFixture().prepared.resolvedCustomer } })).status, 400)
})

test('duplicate idempotency returns completed owner order or 409 without another gateway order', async () => {
  for (const [existing, expected] of [[{ status: 'completed', order_id: orderId, razorpay_order_id: 'order_fake' }, 200], [{ status: 'processing' }, 409], [{ status: 'failed' }, 409]]) {
    const { handlers, calls } = checkoutFixture({ duplicate: true, existing })
    assert.equal((await handlers.handleF7Place(bodyRequest({ idempotencyKey: 'valid-attempt-key1' }))).status, expected)
    assert.equal(calls.some(([name]) => name === 'gateway-create'), false)
  }
})

test('placement records provider/DB failure and preserves a persisted order when attempt completion fails', async () => {
  for (const options of [{ gatewayFailure: true }, { pendingError: true }]) {
    const { handlers, calls } = checkoutFixture(options)
    const response = await handlers.handleF7Place(bodyRequest({ idempotencyKey: 'valid-attempt-key1' }))
    assert.equal(response.status, 500); assert.ok(calls.some(([name]) => name === 'fail'))
    assert.doesNotMatch(JSON.stringify(await response.json()), /private detail/)
  }
  const { handlers } = checkoutFixture({ completionFailure: true })
  assert.equal((await handlers.handleF7Place(bodyRequest({ idempotencyKey: 'valid-attempt-key1' }))).status, 200)
})

test('cancellation rejects wrong/missing owners and nonfailed payments; fails closed on provider outages', async () => {
  for (const [options, expected] of [[{ owner: null }, 401], [{ missingOrder: true }, 404], [{ fetchFailure: true }, 503]]) {
    const { handlers, calls } = checkoutFixture(options)
    assert.equal((await handlers.handleF7Cancel(bodyRequest({ orderId }))).status, expected)
    assert.equal(calls.some(([name]) => name === 'cancel'), false)
  }
  for (const status of ['captured', 'authorized', 'created']) {
    const { handlers, calls } = checkoutFixture({ payments: [{ status }] })
    assert.equal((await (await handlers.handleF7Cancel(bodyRequest({ orderId }))).json()).releaseDenied, true)
    assert.equal(calls.some(([name]) => name === 'cancel'), false)
  }
  const { handlers, calls } = checkoutFixture({ owner: guest, payments: [{ status: 'failed' }] })
  assert.equal((await (await handlers.handleF7Cancel(bodyRequest({ orderId }))).json()).released, true)
  assert.deepEqual(calls.find(([name]) => name === 'cancel').slice(1), [guest, orderId])
})

const verifyPayload = { orderId, razorpay_order_id: 'order_fake', razorpay_payment_id: 'pay_fake', razorpay_signature: 'fake' }
test('verify rejects wrong owner, order reference, signature and uncaptured/mismatched gateway payment', async () => {
  for (const [options, expected] of [[{ owner: null }, 401], [{ missingOrder: true }, 404],
    [{ order: { razorpay_order_id: 'different' } }, 400], [{ validSignature: false }, 400], [{ captureFailure: true }, 500]]) {
    const { handlers, calls } = checkoutFixture(options)
    assert.equal((await handlers.handleF7Verify(bodyRequest(verifyPayload))).status, expected)
    assert.equal(calls.some(([name]) => name === 'finalize'), false)
  }
})

test('verify JPY finalization receives whole-yen amount and browser owner; recovery must be durable', async () => {
  const { handlers, calls } = checkoutFixture({ owner: guest, order: { payment_currency: 'JPY', payment_amount: 112 } })
  assert.equal((await handlers.handleF7Verify(bodyRequest(verifyPayload))).status, 200)
  assert.equal(calls.find(([name]) => name === 'capture')[1].amountInSubunits, 112)
  assert.deepEqual(calls.find(([name]) => name === 'finalize')[2], guest)
  for (const [recovery, expected] of [[{ durable: false }, 500], [{ durable: true, status: 'failed' }, 202], [{ durable: true, status: 'refund_pending' }, 202]]) {
    const fixture = checkoutFixture({ finalization: { error: 'unavailable', errorCode: 'insufficient_stock', orderId }, recovery })
    assert.equal((await fixture.handlers.handleF7Verify(bodyRequest(verifyPayload))).status, expected)
  }
})

function gatewayFixture(options = {}) {
  process.env.RAZORPAY_KEY_ID = 'fake-key'
  process.env.RAZORPAY_KEY_SECRET = 'fake-payment-secret'
  process.env.RAZORPAY_WEBHOOK_SECRET = 'fake-webhook-secret'
  const calls = []
  const entity = { id: 'pay_fake', order_id: 'order_fake', amount: 11200, currency: 'USD', status: 'captured', ...options.payment }
  let fetchCount = 0
  class FakeRazorpay {
    payments = {
      fetch: async () => { fetchCount += 1; calls.push(['fetch']); return fetchCount > 1 && options.afterCapture ? options.afterCapture : entity },
      capture: async (...args) => { calls.push(['capture', ...args]); if (options.captureThrows) throw new Error('race');
        return { ...entity, status: 'captured', ...options.captureResult } },
      refund: async (...args) => { calls.push(['refund', ...args]); if (options.refundThrows) throw new Error('private detail');
        return { id: 'rfnd_fake', status: options.refundStatus || 'processed' } },
    }
  }
  return { gateway: load('lib/razorpay.ts', { razorpay: FakeRazorpay }), calls }
}

test('real Razorpay HMAC accepts valid signatures and rejects malformed, forged and wrong-order signatures', () => {
  const { gateway } = gatewayFixture()
  const signature = createHmac('sha256', 'fake-payment-secret').update('order_fake|pay_fake').digest('hex')
  assert.equal(gateway.verifyRazorpayPaymentSignature({ orderId: 'order_fake', paymentId: 'pay_fake', signature }), true)
  for (const invalid of ['', 'z'.repeat(64), '0'.repeat(64), signature.slice(1)]) {
    assert.equal(gateway.verifyRazorpayPaymentSignature({ orderId: 'order_fake', paymentId: 'pay_fake', signature: invalid }), false)
  }
  assert.equal(gateway.verifyRazorpayPaymentSignature({ orderId: 'order_other', paymentId: 'pay_fake', signature }), false)
})

test('real gateway capture check rejects order/amount/currency/status mismatch before capture and handles authorized races', async () => {
  const expected = { orderId: 'order_fake', paymentId: 'pay_fake', amountInSubunits: 11200, currency: 'USD' }
  for (const payment of [{ id:'different' }, { order_id: 'different' }, { amount: 112 }, { currency: 'INR' },
    { status: 'failed' }, { amount_refunded:1 }]) {
    const { gateway, calls } = gatewayFixture({ payment })
    await assert.rejects(gateway.ensureRazorpayPaymentCaptured(expected))
    assert.equal(calls.some(([name]) => name === 'capture'), false)
  }
  const authorized = gatewayFixture({ payment: { status: 'authorized' } })
  assert.equal((await authorized.gateway.ensureRazorpayPaymentCaptured(expected)).status, 'captured')
  const race = gatewayFixture({ payment: { status: 'authorized' }, captureThrows: true,
    afterCapture: { id: 'pay_fake', order_id: 'order_fake', amount: 11200, currency: 'USD', status: 'captured' } })
  assert.equal((await race.gateway.ensureRazorpayPaymentCaptured(expected)).status, 'captured')
  await assert.rejects(gatewayFixture({ payment: { status: 'authorized' }, captureResult: { amount: 1 } }).gateway.ensureRazorpayPaymentCaptured(expected))
})

function webhookFixture(options = {}) {
  enable()
  const { gateway, calls } = gatewayFixture(options)
  const handler = load('lib/f7-webhook-handler.ts', {
    '@/lib/f7-checkout-handlers': { f7Json: (body, status = 200) => Response.json(body, { status }) },
    '@/lib/f7-write-prepared': flags, '@/lib/razorpay': gateway, '@/lib/payment-subunits': subunits,
    '@/lib/repositories/checkout-repository': { findGatewayOrder: async () => options.missingOrder ? null : { ...order, ...options.order } },
    '@/lib/repositories/payment-repository': {
      claimRdsWebhook: async (input) => { calls.push(['claim-webhook', input]); return !options.duplicate },
      completeRdsWebhook: async (input) => { calls.push(['complete-webhook', input]); if (options.completionFailure) throw new Error('private detail') },
      failRdsPayment: async (input) => calls.push(['failed-webhook', input]),
      recordRdsRefundEvent: async (input) => calls.push(['refund-webhook', input]),
    },
    '@/lib/f7-payment': { finalizeF7Payment: async (...input) => { calls.push(['finalize-webhook', ...input]);
      return options.finalization || { data: { orderId } } },
      recoverF7CapturedPayment: async () => options.recovery || { durable: true, status: 'refunded' } },
    '@/lib/payment-recovery': { REFUNDABLE_FINALIZATION_ERRORS: new Set(['finalization_rpc_error']) },
  }).handleF7Webhook
  const request = (payload, signature, eventId = 'event_fake') => {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload)
    return new Request('https://store.test/api/payments/webhook', { method: 'POST', body: raw,
      headers: { 'x-razorpay-signature': signature ?? createHmac('sha256', 'fake-webhook-secret').update(raw).digest('hex'),
        ...(eventId ? { 'x-razorpay-event-id': eventId } : {}) } })
  }
  return { handler, calls, request }
}
const capturedEvent = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_fake', order_id: 'order_fake', amount: 11200, currency: 'USD' } } } }

test('webhook signature/JSON rejection precedes claim; duplicate events skip all gateway work', async () => {
  const fixture = webhookFixture()
  assert.equal((await fixture.handler(fixture.request(capturedEvent, '0'.repeat(64)))).status, 400)
  assert.equal((await fixture.handler(fixture.request('malformed-json'))).status, 400)
  assert.equal(fixture.calls.length, 0)
  const duplicate = webhookFixture({ duplicate: true })
  assert.deepEqual(await (await duplicate.handler(duplicate.request(capturedEvent))).json(), { ok: true, duplicate: true })
  assert.deepEqual(duplicate.calls.map(([name]) => name), ['claim-webhook'])
})

test('webhook binds capture to stored amount/currency, finalizes through provider order and records completion', async () => {
  const fixture = webhookFixture()
  assert.equal((await fixture.handler(fixture.request(capturedEvent))).status, 200)
  const finalized = fixture.calls.find(([name]) => name === 'finalize-webhook')
  assert.equal(finalized[1].orderId, orderId); assert.equal(finalized[1].paymentAmountInSubunits, 11200)
  assert.ok(fixture.calls.some(([name]) => name === 'complete-webhook'))
  for (const options of [{ order: { payment_amount: 1 } }, { order: { payment_currency: 'INR' } }, { missingOrder: true }]) {
    const mismatch = webhookFixture(options)
    assert.equal((await mismatch.handler(mismatch.request(capturedEvent))).status, 500)
    assert.equal(mismatch.calls.some(([name]) => ['capture', 'fetch', 'complete-webhook'].includes(name)), false)
  }
})

test('webhook JPY uses whole yen and rejects nondurable recovery/completion failures for retry', async () => {
  const event = { ...capturedEvent, payload: { payment: { entity: { ...capturedEvent.payload.payment.entity, amount: 112, currency: 'JPY' } } } }
  const fixture = webhookFixture({ order: { payment_currency: 'JPY' }, payment: { amount: 112, currency: 'JPY' } })
  assert.equal((await fixture.handler(fixture.request(event))).status, 200)
  assert.equal(fixture.calls.find(([name]) => name === 'finalize-webhook')[1].paymentAmountInSubunits, 112)
  for (const options of [{ completionFailure: true }, { finalization: { error: 'failed', errorCode: 'finalization_rpc_error', orderId }, recovery: { durable: false } }]) {
    const retry = webhookFixture(options)
    assert.equal((await retry.handler(retry.request(capturedEvent))).status, 500)
  }
})

test('webhook failure/refund events preserve references and missing event IDs use stable body deduplication', async () => {
  const failed = webhookFixture()
  assert.equal((await failed.handler(failed.request({ ...capturedEvent, event: 'payment.failed' }, undefined, null))).status, 200)
  assert.match(failed.calls.find(([name]) => name === 'claim-webhook')[1].eventId, /^body-[0-9a-f]{64}$/)
  assert.equal(failed.calls.find(([name]) => name === 'failed-webhook')[1].orderId, orderId)
  for (const event of ['refund.processed', 'refund.failed']) {
    const refund = webhookFixture()
    assert.equal((await refund.handler(refund.request({ event, payload: { refund: { entity: { id: 'rfnd_fake', payment_id: 'pay_fake' } } } }))).status, 200)
    assert.equal(refund.calls.find(([name]) => name === 'refund-webhook')[1].status, event === 'refund.processed' ? 'refunded' : 'failed')
  }
})

function paymentServiceFixture(options = {}) {
  const { gateway, calls } = gatewayFixture(options)
  const services = load('lib/f7-payment.ts', {
    '@/lib/razorpay': gateway,
    '@/lib/email': { sendOrderConfirmationEmail: async (input) => calls.push(['email', input]) },
    '@/lib/repositories/payment-repository': {
      finalizeRdsOrder: async () => ({ order, result: { ok: true, already_paid: options.alreadyPaid || false,
        order_id: orderId, order_number: 'HOD-TEST', ...options.finalization } }),
      loadConfirmationItems: async () => [{ product_name: 'Ring', quantity: 1, line_total: 100 }],
      claimRdsRecovery: async () => { calls.push(['claim-recovery']); if (options.claimThrows) throw new Error('db down');
        return { action_id: 'action_fake', action_status: options.duplicate ? 'refunded' : 'processing', should_attempt: !options.duplicate } },
      updateRdsRecovery: async (input) => { calls.push(['update-recovery', input]); if (options.updateThrows) throw new Error('db down') },
    },
  })
  return { services, calls }
}

test('paid finalization sends snapshot-priced email once and duplicate-paid result skips email', async () => {
  const input = { orderId, razorpayOrderId: 'order_fake', paymentId: 'pay_fake', paymentAmountInSubunits: 11200, paymentCurrency: 'USD', gatewayPaymentStatus: 'captured' }
  const first = paymentServiceFixture()
  assert.equal((await first.services.finalizeF7Payment(input, customer)).data.orderNumber, 'HOD-TEST')
  const email = first.calls.find(([name]) => name === 'email')[1]
  assert.equal(email.totalAmount, 112); assert.equal(email.subtotalAmount, 100); assert.equal(email.items[0].line_total, 100)
  const second = paymentServiceFixture({ alreadyPaid: true })
  await second.services.finalizeF7Payment(input, customer)
  assert.equal(second.calls.some(([name]) => name === 'email'), false)
})

test('captured recovery durably queues without refunding after ambiguous finalization', async () => {
  const input = { orderId, paymentId: 'pay_fake', amountInSubunits: 11200, currency: 'USD', reasonCode: 'finalization_rpc_error' }
  for (const options of [{}, { duplicate: true }, { claimThrows: true }, { updateThrows: true }, { refundThrows: true }]) {
    const fixture = paymentServiceFixture(options)
    const result = await fixture.services.recoverF7CapturedPayment(input)
    if (options.claimThrows) assert.equal(result.durable, false)
    else assert.equal(result.durable, true)
    assert.equal(fixture.calls.some(([name]) => name === 'refund'), false)
    assert.equal(fixture.calls.some(([name]) => name === 'update-recovery'), false)
    if (!options.duplicate && !options.claimThrows) assert.equal(result.status, 'processing')
    if (!options.duplicate && !options.claimThrows) assert.equal(fixture.calls[0][0], 'claim-recovery')
  }
})

test('owner predicates and finalization function parameter order are preserved in SQL repositories', async () => {
  enable()
  const calls = []
  const query = async (sql, values, meta) => { calls.push({ sql, values, meta }); return queryResult([order]) }
  const checkout = load('lib/repositories/checkout-repository.ts', { '@/lib/db/query': { query },
    '@/lib/db/transaction': { withTransaction: async () => {} }, '@/lib/f7-write-prepared': flags })
  for (const owner of [customer, guest]) {
    await checkout.findOwnedOrder(owner, { number: "HOD-' OR 1=1" })
    const call = calls.at(-1)
    assert.doesNotMatch(call.sql, /HOD-/); assert.equal(call.values[1], "HOD-' OR 1=1")
    assert.deepEqual(call.values.slice(2), owner.kind === 'customer' ? [customer.id, null] : [null, guest.hash])
    assert.match(call.sql, /user_id is null/); assert.match(call.sql, /customer_identity_id = \$3::uuid/)
  }
  const payment = load('lib/repositories/payment-repository.ts', { '@/lib/db/query': { query },
    '@/lib/db/transaction': { withTransaction: async (callback) => callback({ query: async (sql, values) => {
      calls.push({ sql, values }); return queryResult(sql.includes('finalize_paid_order') ? [{ ok: true }] : [order]) } }) },
    '@/lib/f7-write-prepared': flags, '@/lib/repositories/checkout-repository': checkout })
  const input = { orderId, razorpayOrderId: 'order_fake', paymentId: 'pay_fake', signature: 'sig',
    paymentMethod: 'card', paymentContact: 'phone', paymentEmail: 'email', gatewayPaymentStatus: 'captured',
    paymentAmountInSubunits: 112, paymentCurrency: 'JPY', rawEvent: { fake: true } }
  await payment.finalizeRdsOrder(input, guest)
  const locked = calls.find(({ sql }) => sql.includes('for update'))
  assert.match(locked.sql, /for update/); assert.deepEqual(locked.values.slice(2), [false, null, guest.hash])
  assert.deepEqual(calls.at(-1).values, [orderId, 'order_fake', 'pay_fake', 'sig', 'card', 'phone', 'email', 'captured', 112, 'JPY', '{"fake":true}'])
})

test('SQL failure and customer cancellation lock owner, release within transaction and never use legacy cancel identity', async () => {
  enable()
  const calls = []
  const transaction = { withTransaction: async (callback) => callback({ query: async (sql, values) => {
    calls.push({ sql, values }); return queryResult([{ fulfillment_mode: 'made_to_order', id: orderId }]) } }) }
  const checkout = load('lib/repositories/checkout-repository.ts', { '@/lib/db/query': { query: async () => queryResult() },
    '@/lib/db/transaction': transaction, '@/lib/f7-write-prepared': flags })
  assert.equal(await checkout.cancelOwnedOrder(customer, orderId), true)
  assert.match(calls[0].sql, /for update/); assert.deepEqual(calls[0].values, [orderId, customer.id, null])
  assert.match(calls[1].sql, /release_order_inventory_reservation/); assert.match(calls[2].sql, /customer_identity_id = \$2/)
  assert.equal(calls.some(({ sql }) => sql.includes('cancel_pending_checkout(')), false)
  calls.length = 0
  const payment = load('lib/repositories/payment-repository.ts', { '@/lib/db/query': { query: async () => queryResult() },
    '@/lib/db/transaction': transaction, '@/lib/f7-write-prepared': flags, '@/lib/repositories/checkout-repository': checkout })
  await payment.failRdsPayment({ orderId, razorpayOrderId: 'order_fake', error: { code: 'failed' } }, customer)
  assert.match(calls[0].sql, /payment_status = 'pending'/); assert.deepEqual(calls[0].values.slice(9), [false, customer.id, null])
  assert.match(calls[1].sql, /release_order_inventory_reservation/)
})

test('every mutation repository and pending creation fails before SQL when gate is OFF', async () => {
  const fixture = checkoutFixture()
  delete process.env.HOD_F7_RDS_WRITE_PREPARED
  await assert.rejects(fixture.domain.createPendingOrder({ userId: null, customerIdentityId: customer.id,
    guestTokenHash: null, payload: {}, prepared: fixture.prepared, razorpayOrderId: 'order_fake', rdsWritePrepared: true }))
  assert.equal(fixture.calls.length, 0)
  const forbidden = async () => { throw new Error('SQL must not be reached') }
  const checkout = load('lib/repositories/checkout-repository.ts', { '@/lib/db/query': { query: forbidden },
    '@/lib/db/transaction': { withTransaction: forbidden }, '@/lib/f7-write-prepared': flags })
  const payment = load('lib/repositories/payment-repository.ts', { '@/lib/db/query': { query: forbidden },
    '@/lib/db/transaction': { withTransaction: forbidden }, '@/lib/f7-write-prepared': flags, '@/lib/repositories/checkout-repository': checkout })
  for (const name of ['finalizeRdsOrder', 'failRdsPayment', 'claimRdsWebhook', 'completeRdsWebhook', 'claimRdsRecovery', 'updateRdsRecovery', 'recordRdsRefundEvent']) {
    await assert.rejects(payment[name]({}), /RDS checkout is disabled/)
  }
  const attempts = load('lib/repositories/checkout-attempt-repository.ts', { '@/lib/db/query': { query: forbidden }, '@/lib/f7-write-prepared': flags })
  await assert.rejects(attempts.createCheckoutAttempt(customer, 'key'), /RDS checkout is disabled/)
  await assert.rejects(attempts.completeCheckoutAttempt(customer, 'attempt', orderId, 'order_fake'), /RDS checkout is disabled/)
  await assert.rejects(attempts.failCheckoutAttempt(customer, 'attempt', 'failed'), /RDS checkout is disabled/)
})

test('proxy and page use the same two-flag checkout gate; direct create-order remains disabled', () => {
  const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8')
  assert.match(proxy, /pathname === '\/api\/checkout\/place'/)
  assert.match(proxy, /HOD_CUSTOMER_AUTH_ENABLED !== 'true' \|\| process.env.HOD_F7_RDS_WRITE_PREPARED !== 'true'/)
  const page = readFileSync(new URL('../app/checkout/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /if \(!isF7WritePrepared\(\)\)/)
  assert.match(page, /await connection\(\)/)
  for (const path of ['login', 'signup', 'profile']) {
    assert.match(readFileSync(new URL(`../app/${path}/page.tsx`, import.meta.url), 'utf8'), /await connection\(\)/)
  }
  assert.match(readFileSync(new URL('../app/api/create-order/route.ts', import.meta.url), 'utf8'), /status: 403/)
})

function resultFixture(options = {}) {
  enable()
  const calls = []
  const handlers = load('lib/f7-result-handlers.ts', {
    '@/lib/f7-checkout-handlers': { f7Json: (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } }) },
    '@/lib/f7-checkout-owner': { resolveF7CheckoutOwner: async () => options.owner === null ? null : options.owner || customer },
    '@/lib/f7-write-prepared': flags, '@/lib/rate-limit': { enforceRateLimit: async () => ({ ok: true }) },
    '@/lib/media-url': { mediaUrl: (path) => path ? `https://media.test/${path}` : '' },
    '@/lib/repositories/checkout-repository': {
      findOwnedOrder: async (...args) => { calls.push(['owner-order', ...args]); return options.missingOrder ? null : { ...order, ...options.order } },
      listOrderItems: async (...args) => { calls.push(['owner-items', ...args]); return [{ product_name: 'Ring', unit_price: 100, line_total: 100 }] },
      listOrderHistory: async (...args) => { calls.push(['owner-history', ...args]); return [{ status: 'pending', created_at: '2026-10-11T00:00:00Z' }] },
    },
    '@/lib/repositories/checkout-result-repository': { loadCheckoutResultContent: async () => ({ page: { main_banner_image_path: 'banner.png' },
      state: { heading: 'Confirmed' }, contact: [], categories: [{ name: 'Rings', slug: 'rings' }] }) },
    '@/lib/razorpay': { findCapturedOrAuthorizedPayment: async () => { if (options.gatewayFailure) throw new Error('gateway down'); return options.candidate || null },
      ensureRazorpayPaymentCaptured: async () => ({ id: 'pay_fake', amount: 11200, currency: 'USD', status: 'captured' }) },
    '@/lib/payment-subunits': subunits,
    '@/lib/f7-payment': { finalizeF7Payment: async (...args) => { calls.push(['owner-finalize', ...args]); return { data: { orderId } } } },
    '@/lib/repositories/customer-orders-repository': { listCustomerOrders: async (...args) => { calls.push(['owner-orders', ...args]); return { orders: [order], total: 11 } } },
  })
  return { handlers, calls }
}

test('success rejects missing/wrong owner before loading content; preserves immutable totals, media and history response', async () => {
  const request = () => new Request('https://store.test/api/checkout/success?order=HOD-TEST')
  for (const [options, status] of [[{ owner: null }, 401], [{ missingOrder: true }, 404]]) {
    const fixture = resultFixture(options)
    assert.equal((await fixture.handlers.handleF7Success(request())).status, status)
    assert.equal(fixture.calls.some(([name]) => name === 'owner-items'), false)
  }
  const fixture = resultFixture({ owner: guest, order: { payment_status: 'paid',
    gateway_payload: { totals: { chargedSubtotal: 200, chargedGst: 24, shippingCharged: 10, exchangeRate: 2 } } } })
  const response = await fixture.handlers.handleF7Success(request())
  const body = await response.json()
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(body.state, 'success'); assert.equal(body.order.subtotal_amount, 200)
  assert.equal(body.order.items[0].line_total, 200); assert.equal(body.statusEvents.length, 1)
  assert.equal(body.cms.page.main_banner_image_url, 'https://media.test/banner.png')
  assert.deepEqual(fixture.calls.find(([name]) => name === 'owner-history').slice(1), [guest, orderId])
})

test('success self-reconciliation binds browser owner and remains pending on gateway failure', async () => {
  const request = () => new Request('https://store.test/api/checkout/success?order=HOD-TEST')
  const captured = resultFixture({ candidate: { id: 'pay_fake' } })
  assert.equal((await (await captured.handlers.handleF7Success(request())).json()).state, 'success')
  assert.deepEqual(captured.calls.find(([name]) => name === 'owner-finalize')[2], customer)
  const outage = resultFixture({ gatewayFailure: true })
  assert.equal((await (await outage.handlers.handleF7Success(request())).json()).state, 'pending')
})

test('profile orders requires customer owner and bounds pagination; guest cannot enumerate customer history', async () => {
  for (const owner of [null, guest]) {
    const fixture = resultFixture({ owner })
    assert.equal((await fixture.handlers.handleF7ProfileOrders(new Request('https://store.test/api/profile/orders'))).status, 401)
    assert.equal(fixture.calls.length, 0)
  }
  const fixture = resultFixture()
  assert.equal((await fixture.handlers.handleF7ProfileOrders(new Request('https://store.test/api/profile/orders?page=NaN'))).status, 400)
  const response = await fixture.handlers.handleF7ProfileOrders(new Request('https://store.test/api/profile/orders?page=2&pageSize=5'))
  assert.deepEqual((await response.json()).pagination, { page: 2, pageSize: 5, total: 11, totalPages: 3 })
  assert.deepEqual(fixture.calls.at(-1).slice(1), [customer, 2, 5])
})
