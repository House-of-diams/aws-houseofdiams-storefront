import { NextResponse } from 'next/server'
import { findPromotionPopupFromRds } from '@/lib/repositories/public-cms-repository'

export const dynamic = 'force-dynamic'

async function readPublicContent() {
  const result = await findPromotionPopupFromRds()
  if (!result) return NextResponse.json({ item: null }, { headers: { 'Cache-Control': 'no-store' } })
  const fallbackQuestions = [{ id: 0, field_key: 'email', question: 'What is your email address?', input_type: 'email', validation_pattern: null, validation_message: 'Enter a valid email address.', is_required: true, sort_order: 0 }]
  return NextResponse.json({ item: { ...result.item, questions: result.questions.length ? result.questions : fallbackQuestions } }, { headers: { 'Cache-Control': 'no-store' } })

}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
