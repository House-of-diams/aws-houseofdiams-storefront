import crypto from 'node:crypto'
import Razorpay from 'razorpay'


export function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID || ''
}

export function isRazorpayConfigured() {
  return Boolean(getRazorpayKeyId() && process.env.RAZORPAY_KEY_SECRET)
}

export function getRazorpayClient() {
  const key_id = getRazorpayKeyId()
  const key_secret = process.env.RAZORPAY_KEY_SECRET
  if (!key_id || !key_secret) throw new Error('Missing Razorpay environment variables.')
  return new Razorpay({ key_id, key_secret })
}

export async function ensureRazorpayPaymentCaptured(input: {
  paymentId: string
  orderId: string
  amountInSubunits: number
  currency: string
}) {
  const razorpay = getRazorpayClient()
  let payment = await razorpay.payments.fetch(input.paymentId)
  const expectedCurrency = input.currency.toUpperCase()
  const matches = () => payment.id === input.paymentId && payment.order_id === input.orderId
    && Number(payment.amount) === input.amountInSubunits
    && Number(payment.amount_refunded || 0) === 0
    && String(payment.currency || '').toUpperCase() === expectedCurrency

  if (!matches()) throw new Error('Razorpay payment does not match the expected order, amount, or currency.')
  if (payment.status === 'captured') return payment

  if (payment.status === 'authorized') {
    try {
      payment = await razorpay.payments.capture(input.paymentId, input.amountInSubunits, expectedCurrency)
    } catch (captureError) {
      // A webhook and browser callback can race. Re-fetch before treating capture as failed.
      payment = await razorpay.payments.fetch(input.paymentId)
      if (payment.status !== 'captured') throw captureError
    }
    if (!matches()) throw new Error('Captured Razorpay payment no longer matches the expected order.')
  }

  if (payment.status !== 'captured') throw new Error(`Razorpay payment is ${payment.status || 'not captured'}.`)
  return payment
}

export async function findCapturedOrAuthorizedPayment(orderId: string) {
  const result = await getRazorpayClient().orders.fetchPayments(orderId)
  return result.items.find((payment) => payment.status === 'captured')
    || result.items.find((payment) => payment.status === 'authorized')
    || null
}

function safeEqualHex(expectedHex: string, suppliedHex: unknown) {
  const hexPattern = /^[0-9a-f]+$/i
  if (typeof suppliedHex !== 'string' || expectedHex.length === 0 || expectedHex.length !== suppliedHex.length || expectedHex.length % 2 !== 0 || !hexPattern.test(expectedHex) || !hexPattern.test(suppliedHex)) return false
  const expectedBuffer = Buffer.from(expectedHex, 'hex')
  const suppliedBuffer = Buffer.from(suppliedHex, 'hex')
  if (expectedBuffer.length !== suppliedBuffer.length) return false
  return crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
}

export function verifyRazorpayPaymentSignature(input: { orderId: string; paymentId: string; signature: string }) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keySecret) throw new Error('Missing Razorpay secret key.')
  const expected = crypto.createHmac('sha256', keySecret).update(`${input.orderId}|${input.paymentId}`).digest('hex')
  return safeEqualHex(expected, input.signature)
}

export function verifyRazorpayWebhookSignature(payload: string, signature: string) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!webhookSecret) throw new Error('Missing Razorpay webhook secret.')
  const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex')
  return safeEqualHex(expected, signature)
}
