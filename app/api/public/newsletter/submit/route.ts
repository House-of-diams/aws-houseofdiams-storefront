import { NextResponse } from 'next/server'
import { getPostgresErrorCode } from '@/lib/db/errors'
import { insertNewsletterSubmission } from '@/lib/repositories/public-forms-repository'
import { enforceRateLimit } from '@/lib/rate-limit'
import { isValidEmail } from '@/lib/validation'

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: 'Newsletter signup is temporarily unavailable.' }, { status: 503 })
  }

  const rateLimit = await enforceRateLimit(request, { key: 'public-newsletter-submit', limit: 6, windowSeconds: 60 })
  if (!rateLimit.ok && rateLimit.response) return rateLimit.response

  const body = await request.json().catch(() => null)
  if (!body || typeof body.email !== 'string') {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const email = body.email.trim().toLowerCase()
  if (!email || email.length > 254 || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  try {
    await insertNewsletterSubmission(email)
  } catch (error) {
    if (getPostgresErrorCode(error) === '42P01') {
      return NextResponse.json({ error: 'Newsletter storage is not enabled yet.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Unable to subscribe right now.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
