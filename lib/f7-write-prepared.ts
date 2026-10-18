import 'server-only'

// Shared server-side release gate for RDS checkout and payment handlers.
export function isF7WritePrepared() {
  return process.env.HOD_F7_RDS_WRITE_PREPARED === 'true'
    && process.env.HOD_CUSTOMER_AUTH_ENABLED === 'true'
}

export function requireF7WritePrepared() {
  if (!isF7WritePrepared()) throw new Error('RDS checkout is disabled.')
}
