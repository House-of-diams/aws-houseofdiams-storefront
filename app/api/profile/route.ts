import { NextResponse } from 'next/server'
import { getCustomerAuthConfig } from '@/lib/customer-auth/config'
import { resolveF7CheckoutOwner } from '@/lib/f7-checkout-owner'
import { isSameOriginMutation, readBoundedJson } from '@/lib/customer-auth/security'
import { loadCheckoutCustomerProfile, saveCustomerProfile } from '@/lib/repositories/checkout-profile-repository'
import { enforceRateLimit } from '@/lib/rate-limit'

const NAME_PATTERN = /^[\p{L}][\p{L}\p{M}' -]{0,79}$/u
const PHONE_PATTERN = /^\+?[0-9(). -]{7,24}$/

async function getAuthenticatedClients(request: Request) {
  if (!getCustomerAuthConfig()) return { error: 'Customer authentication is disabled.', status: 404 as const }
  const identity = await resolveF7CheckoutOwner(request)
  if (identity?.kind !== 'customer') return { error: 'Unauthorized.', status: 401 as const }
  return { user: identity }
}

function optionalText(value: unknown, label: string, maxLength: number) {
  if (value == null) return { value: null }
  if (typeof value !== 'string') return { error: `${label} must be text.` }
  const normalized = value.trim()
  if (/[\u0000-\u001F\u007F]/.test(normalized)) return { error: `${label} contains invalid characters.` }
  if (normalized.length > maxLength) return { error: `${label} must be ${maxLength} characters or fewer.` }
  return { value: normalized || null }
}

function requiredName(value: unknown, label: string) {
  if (typeof value !== 'string') return { error: `${label} is required.` }
  const normalized = value.trim()
  if (!NAME_PATTERN.test(normalized)) return { error: `${label} must be 1–80 characters and contain only letters, spaces, apostrophes, or hyphens.` }
  return { value: normalized }
}

function optionalPhone(value: unknown) {
  const result = optionalText(value, 'Phone', 40)
  if ('error' in result || !result.value) return result
  if (!PHONE_PATTERN.test(result.value)) return { error: 'Phone must contain a valid phone number.' }
  return result
}

function optionalDate(value: unknown, label: string) {
  if (value == null || value === '') return { value: null }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: `${label} must be a valid date.` }
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return { error: `${label} must be a valid date.` }
  return { value }
}

async function getProfile(request: Request) {
  const access = await getAuthenticatedClients(request)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  const data = await loadCheckoutCustomerProfile(access.user.id)
  return NextResponse.json({
    profile: {
      ...data,
      email: data?.email || access.user.email || '',
      first_name: data?.first_name || '',
      last_name: data?.last_name || '',
      phone: data?.phone || '',
    },
  })
}

async function patchProfile(request: Request) {
  const access = await getAuthenticatedClients(request)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  const config = getCustomerAuthConfig()!
  if (!isSameOriginMutation(request, config.baseUrl)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  const limit = await enforceRateLimit(request, { key: 'customer-profile-write', limit: 20, windowSeconds: 60 })
  if (!limit.ok && limit.response) return limit.response
  const parsed = await readBoundedJson(request, 8192)
  if (!parsed.ok) return NextResponse.json({ error: 'Invalid profile payload.' }, { status: parsed.status })
  const body = parsed.value as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid profile payload.' }, { status: 400 })

  const firstName = requiredName(body.first_name, 'First name')
  if ('error' in firstName) return NextResponse.json({ error: firstName.error }, { status: 400 })
  const lastName = requiredName(body.last_name, 'Last name')
  if ('error' in lastName) return NextResponse.json({ error: lastName.error }, { status: 400 })
  const phone = optionalPhone(body.phone)
  if ('error' in phone) return NextResponse.json({ error: phone.error }, { status: 400 })

  const specs = [
    ['country', 'Country', 100], ['state', 'State', 100], ['district', 'District', 100], ['city', 'City', 100],
    ['postal_code', 'Postal code', 24], ['address_line_1', 'Address line 1', 200], ['address_line_2', 'Address line 2', 200],
  ] as const
  const update: Record<string, string | null> = { first_name: firstName.value, last_name: lastName.value, phone: phone.value ?? null }
  for (const [key, label, maxLength] of specs) {
    const result = optionalText(body[key], label, maxLength)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
    update[key] = result.value ?? null
  }
  for (const [key, label] of [['birth_date', 'Birth date'], ['anniversary_date', 'Anniversary date']] as const) {
    const result = optionalDate(body[key], label)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
    update[key] = result.value ?? null
  }
  if (update.birth_date && update.birth_date > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: 'Birth date cannot be in the future.' }, { status: 400 })
  }
  if (update.anniversary_date && update.anniversary_date > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: 'Anniversary date cannot be in the future.' }, { status: 400 })
  }

  const profile = await saveCustomerProfile(access.user.id, update)
  const data = { ...profile, email: access.user.email }
  return NextResponse.json({ profile: data })
}

export async function GET(request: Request) {
  try {
    const response = await getProfile(request)
    response.headers.set('cache-control', 'no-store')
    return response
  }
  catch { return NextResponse.json({ error: 'Unable to load your profile.' }, { status: 503 }) }
}

export async function PATCH(request: Request) {
  try {
    const response = await patchProfile(request)
    response.headers.set('cache-control', 'no-store')
    return response
  }
  catch { return NextResponse.json({ error: 'Unable to save your profile.' }, { status: 503 }) }
}
