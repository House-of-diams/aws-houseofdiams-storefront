import { createPublicKey, verify } from 'node:crypto'

export function validateIdentityToken(
  token: string,
  jwk: { kty: string; n: string; e: string },
  expected: { issuer: string; clientId: string; nonce: string; now?: number },
) {
  const parts = token.split('.')
  if (parts.length !== 3 || token.length > 32768) throw new Error('Invalid identity token.')
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
  if (header.alg !== 'RS256' || jwk.kty !== 'RSA') throw new Error('Unsupported token algorithm.')
  const key = createPublicKey({ key: jwk, format: 'jwk' })
  if (!verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'))) {
    throw new Error('Invalid token signature.')
  }
  const now = expected.now ?? Math.floor(Date.now() / 1000)
  const audience = claims.aud
  if (claims.iss !== expected.issuer ||
      !(audience === expected.clientId || (Array.isArray(audience) && audience.includes(expected.clientId))) ||
      (claims.azp !== undefined && claims.azp !== expected.clientId) ||
      (Array.isArray(audience) && audience.length > 1 && claims.azp !== expected.clientId) ||
      !Number.isFinite(claims.exp) || claims.exp <= now ||
      !Number.isFinite(claims.iat) || claims.iat > now + 60 ||
      (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now)) ||
      claims.nonce !== expected.nonce || typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255 ||
      typeof claims.email !== 'string' || !claims.email.trim() || claims.email.length > 254 ||
      claims.email_verified !== true) {
    throw new Error('Identity token claims failed validation.')
  }
  return { subject: claims.sub, email: claims.email.trim().toLowerCase(), emailVerified: true, expiresAt: claims.exp as number }
}

export function isSameOriginMutation(request: Request, origin: string) {
  return request.headers.get('origin') === origin && request.headers.get('sec-fetch-site') !== 'cross-site'
}

export async function readBoundedJson(request: Request, maxBytes: number): Promise<{ ok: true; value: unknown } | { ok: false; status: 400 | 413 }> {
  const declaredLength = request.headers.get('content-length')
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) return { ok: false, status: 400 }
    if (Number(declaredLength) > maxBytes) return { ok: false, status: 413 }
  }

  const reader = request.body?.getReader()
  if (!reader) return { ok: false, status: 400 }
  const chunks: Uint8Array[] = []
  let byteLength = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteLength += value.byteLength
      if (byteLength > maxBytes) {
        await reader.cancel()
        return { ok: false, status: 413 }
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
  } catch {
    return { ok: false, status: 400 }
  }
}
