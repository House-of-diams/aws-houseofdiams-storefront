import { createHash } from 'node:crypto'
import { isIP } from 'node:net'

/**
 * CloudFront must overwrite/forward CloudFront-Viewer-Address, and the origin
 * must only accept traffic through the controlled CloudFront/ALB path. Never
 * use X-Forwarded-For or client-supplied fallback headers as an identity.
 */
export function getTrustedClientIp(headers: Pick<Headers, 'get'>): string | null {
  const rawValue = headers.get('cloudfront-viewer-address')?.trim()
  if (!rawValue) return null

  let address = rawValue
  let port: string | undefined

  const ipv6WithPort = /^\[([^\]]+)\]:(\d+)$/.exec(rawValue)
  if (ipv6WithPort) {
    address = ipv6WithPort[1]
    port = ipv6WithPort[2]
  } else {
    const ipv4WithPort = /^([^:]+):(\d+)$/.exec(rawValue)
    if (ipv4WithPort) {
      address = ipv4WithPort[1]
      port = ipv4WithPort[2]
    } else {
      const ipv6WithPortUnbracketed = /^(.+):(\d+)$/.exec(rawValue)
      if (ipv6WithPortUnbracketed && isIP(ipv6WithPortUnbracketed[1]) === 6) {
        address = ipv6WithPortUnbracketed[1]
        port = ipv6WithPortUnbracketed[2]
      }
    }
  }

  if (isIP(address) === 0) return null
  if (port !== undefined && (!/^\d{1,5}$/.test(port) || Number(port) > 65_535)) return null
  return address
}

let unknownIpWarningLogged = false

/**
 * The trusted CloudFront address, or, when it is missing (a routing problem),
 * a hash of browser headers, so visitors no longer share one 'unknown' bucket
 * where a single busy client blocks everyone.
 */
export function clientIdentity(headers: Pick<Headers, 'get'>) {
  const ip = getTrustedClientIp(headers)
  if (ip) return ip
  if (!unknownIpWarningLogged) {
    console.error('Rate limiting: no trusted CloudFront viewer address on this request; using a per-browser fallback key.')
    unknownIpWarningLogged = true
  }
  const fingerprint = [headers.get('user-agent'), headers.get('accept-language')].map((v) => (v ?? '').slice(0, 300)).join('|')
  return `unknown:${createHash('sha256').update(fingerprint).digest('hex').slice(0, 16)}`
}
