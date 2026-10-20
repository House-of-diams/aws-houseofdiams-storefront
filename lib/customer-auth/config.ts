import 'server-only'

export function getCustomerAuthConfig() {
  if (process.env.HOD_CUSTOMER_AUTH_ENABLED !== 'true') return null

  const issuer = process.env.HOD_CUSTOMER_OIDC_ISSUER?.trim()
  const clientId = process.env.HOD_CUSTOMER_OIDC_CLIENT_ID?.trim()
  const clientSecret = process.env.HOD_CUSTOMER_OIDC_CLIENT_SECRET?.trim()
  const baseUrl = process.env.HOD_CUSTOMER_AUTH_BASE_URL?.trim()
  const sessionSecret = process.env.HOD_CUSTOMER_SESSION_SECRET?.trim()
  if (!issuer || !clientId || !clientSecret || !baseUrl || !sessionSecret) {
    throw new Error('Customer authentication is enabled but required configuration is missing.')
  }

  const issuerUrl = new URL(issuer)
  const appUrl = new URL(baseUrl)
  if (issuerUrl.protocol !== 'https:' || issuerUrl.pathname !== '/realms/hod-customers' || issuerUrl.search || issuerUrl.hash) {
    throw new Error('HOD_CUSTOMER_OIDC_ISSUER must be the HTTPS hod-customers realm issuer URL.')
  }
  if (appUrl.protocol !== 'https:' || appUrl.pathname !== '/' || appUrl.search || appUrl.hash) {
    throw new Error('HOD_CUSTOMER_AUTH_BASE_URL must be an HTTPS origin.')
  }
  if (Buffer.byteLength(sessionSecret, 'utf8') < 32) {
    throw new Error('HOD_CUSTOMER_SESSION_SECRET must contain at least 32 bytes.')
  }

  return { issuer: issuer.replace(/\/$/, ''), clientId, clientSecret, baseUrl: appUrl.origin, sessionSecret }
}

export function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/'
  try {
    const parsed = new URL(value, 'https://storefront.invalid')
    return parsed.origin === 'https://storefront.invalid' ? `${parsed.pathname}${parsed.search}${parsed.hash}` : '/'
  } catch {
    return '/'
  }
}
