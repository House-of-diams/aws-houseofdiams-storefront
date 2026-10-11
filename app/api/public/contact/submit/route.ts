import { NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/rate-limit'
import { insertContactSubmission } from '@/lib/repositories/public-forms-repository'
import { isValidEmail, isValidPhone } from '@/lib/validation'

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL?.trim()) return NextResponse.json({ error: 'Form submission is temporarily unavailable.' }, { status: 503 })
  const rateLimit = await enforceRateLimit(request, { key: 'public-contact-submit', limit: 5, windowSeconds: 60 })
  if (!rateLimit.ok && rateLimit.response) return rateLimit.response
  const body = await request.json().catch(() => null)
  if (!body || typeof body.full_name !== 'string' || typeof body.email !== 'string' || typeof body.topic !== 'string' || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const fullName = body.full_name.trim()
  const email = body.email.trim().toLowerCase()
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const topic = body.topic.trim()
  const message = body.message.trim()

  if (!fullName || fullName.length > 120) {
    return NextResponse.json({ error: 'Enter a valid name.' }, { status: 400 })
  }

  if (!email || email.length > 254 || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  if (phone && !isValidPhone(phone)) {
    return NextResponse.json({ error: 'Enter a valid phone number.' }, { status: 400 })
  }

  if (!topic || topic.length > 120) {
    return NextResponse.json({ error: 'Enter a valid subject.' }, { status: 400 })
  }

  if (!message || message.length < 10 || message.length > 5000) {
    return NextResponse.json({ error: 'Enter a message between 10 and 5000 characters.' }, { status: 400 })
  }

  try {
    await insertContactSubmission({
      full_name: fullName,
      email,
      phone,
      topic,
      message,
    })
  } catch {
    return NextResponse.json({ error: 'Unable to submit the form right now.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
