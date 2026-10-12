import { NextResponse } from 'next/server'
import { findPromotionPopupFromRds } from '@/lib/repositories/public-cms-repository'
import { cachePublicRead, publicCacheHeaders, PUBLIC_CACHE_SHORT_SECONDS } from '@/lib/public-cache'

export const dynamic = 'force-dynamic'

const readPromotionPopup = cachePublicRead('promotion-popup', async () => (await findPromotionPopupFromRds()) ?? null, PUBLIC_CACHE_SHORT_SECONDS)

async function readPublicContent() {
  const headers = publicCacheHeaders(PUBLIC_CACHE_SHORT_SECONDS)
  const result = await readPromotionPopup()
  if (!result) return NextResponse.json({ item: null }, { headers })
  const fallbackQuestions = [{ id: 0, field_key: 'email', question: 'What is your email address?', input_type: 'email', validation_pattern: null, validation_message: 'Enter a valid email address.', is_required: true, sort_order: 0 }]
  return NextResponse.json({ item: { ...result.item, questions: result.questions.length ? result.questions : fallbackQuestions } }, { headers })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
