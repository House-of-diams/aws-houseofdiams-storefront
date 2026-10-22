import 'server-only'

import { query } from '@/lib/db/query'

type ContactSubmission = {
  full_name: string
  email: string
  phone: string
  topic: string
  message: string
}

export async function insertContactSubmission(input: ContactSubmission) {
  await query(
    // Idempotent: an identical enquiry from the same email within 30 seconds (a double-click or a retry) is stored once.
    `INSERT INTO public.contact_submissions (full_name, email, phone, topic, message)
     SELECT $1, $2, $3, $4, $5
      WHERE NOT EXISTS (
        SELECT 1 FROM public.contact_submissions c
         WHERE lower(c.email) = lower($2) AND c.message = $5 AND c.topic IS NOT DISTINCT FROM $4
           AND c.created_at > now() - interval '30 seconds')`,
    [input.full_name, input.email, input.phone, input.topic, input.message],
    { operation: 'forms.contact.insert' },
  )
}

export async function insertNewsletterSubmission(email: string) {
  await query(
    'INSERT INTO public.newsletter_submissions (email, source, status) VALUES ($1, $2, $3)',
    [email, 'homepage_newsletter', 'new'],
    { operation: 'forms.newsletter.insert' },
  )
}

type BespokeSubmission = {
  full_name: string
  email: string
  phone: string
  country: string
  piece_type: string
  stone_preference: string
  approx_carat: string
  preferred_metal: string
  message: string
}

export async function insertBespokeSubmission(input: BespokeSubmission) {
  await query(
    `INSERT INTO public.bespoke_submissions
      (full_name, email, phone, country, piece_type, stone_preference, approx_carat, preferred_metal, message, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [input.full_name, input.email, input.phone, input.country, input.piece_type,
      input.stone_preference, input.approx_carat, input.preferred_metal, input.message, 'new'],
    { operation: 'forms.bespoke.insert' },
  )
}
