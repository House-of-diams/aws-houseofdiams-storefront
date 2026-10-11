import 'server-only'

// Intentionally does not relax proxy.ts: customer-auth mode still returns 503
// for order placement until SQL, ownership, and payment regressions pass.
export function isF7WritePrepared() {
  return process.env.HOD_F7_RDS_WRITE_PREPARED === 'true'
    && process.env.HOD_CUSTOMER_AUTH_ENABLED === 'true'
}

export function requireF7WritePrepared() {
  if (!isF7WritePrepared()) throw new Error('RDS checkout is disabled.')
}
