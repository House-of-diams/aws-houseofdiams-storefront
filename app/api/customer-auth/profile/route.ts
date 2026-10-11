import { NextResponse } from 'next/server'
import { getCustomerAuthConfig } from '@/lib/customer-auth/config'
import { customerAuthCookieNames, getCustomerSession } from '@/lib/customer-auth/oidc'
import { isSameOriginMutation, readBoundedJson } from '@/lib/customer-auth/security'
import { query } from '@/lib/db/query'
import { enforceRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
const fields = ['first_name', 'last_name', 'phone', 'country', 'state', 'district', 'city', 'postal_code', 'address_line_1', 'address_line_2'] as const

async function access(request: Request) {
  const name = customerAuthCookieNames().session
  const token = (request.headers.get('cookie') || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1)
  return getCustomerSession(token)
}

export async function GET(request: Request) {
  if (!getCustomerAuthConfig()) return NextResponse.json({ error: 'Customer authentication is disabled.' }, { status: 404 })
  try {
    const identity = await access(request)
    if (!identity) return NextResponse.json({ error: 'Sign in to view your profile.' }, { status: 401 })
    const result = await query(`select first_name, last_name, phone, country, state, district, city, postal_code, address_line_1, address_line_2 from public.customer_profiles where identity_id = $1`, [identity.id], { operation: 'customer-profile-read' })
    return NextResponse.json({ identity: { id: identity.id, email: identity.email }, profile: result.rows[0] ?? {} }, { headers: { 'cache-control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to load your profile.' }, { status: 503 })
  }
}

export async function PATCH(request: Request) {
  const config = getCustomerAuthConfig()
  if (!config) return NextResponse.json({ error: 'Customer authentication is disabled.' }, { status: 404 })
  if (!isSameOriginMutation(request, config.baseUrl)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  const declaredLength = request.headers.get('content-length')
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > 8192)) {
    return NextResponse.json({ error: 'Profile payload is too large or invalid.' }, { status: Number(declaredLength) > 8192 ? 413 : 400 })
  }
  try {
    const identity = await access(request)
    if (!identity) return NextResponse.json({ error: 'Sign in to update your profile.' }, { status: 401 })
    const limit = await enforceRateLimit(request, { key: 'customer-profile-write', limit: 20, windowSeconds: 60 })
    if (!limit.ok && limit.response) return limit.response
    const parsedBody = await readBoundedJson(request, 8192)
    if (!parsedBody.ok) return NextResponse.json({ error: parsedBody.status === 413 ? 'Profile payload is too large.' : 'Invalid profile.' }, { status: parsedBody.status })
    const parsedValue = parsedBody.value
    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) return NextResponse.json({ error: 'Invalid profile.' }, { status: 400 })
    const body = parsedValue as Record<string, unknown>
    const values = fields.map((field) => {
      const value = body[field]
      if (value == null) return null
      if (typeof value !== 'string' || value.length > 200 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Invalid profile field.')
      return value.trim() || null
    })
    await query(`insert into public.customer_profiles (identity_id, first_name, last_name, phone, country, state, district, city, postal_code, address_line_1, address_line_2)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      on conflict (identity_id) do update set first_name=excluded.first_name, last_name=excluded.last_name,
      phone=excluded.phone, country=excluded.country, state=excluded.state, district=excluded.district,
      city=excluded.city, postal_code=excluded.postal_code, address_line_1=excluded.address_line_1,
      address_line_2=excluded.address_line_2, updated_at=now()`, [identity.id, ...values], { operation: 'customer-profile-update' })
    return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const invalid = error instanceof Error && error.message === 'Invalid profile field.'
    return NextResponse.json({ error: invalid ? 'Profile fields must contain valid text of at most 200 characters.' : 'Unable to save your profile.' }, { status: invalid ? 400 : 503 })
  }
}
