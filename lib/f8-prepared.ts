import 'server-only'
import { isF7WritePrepared } from '@/lib/f7-write-prepared'

export function isF8Prepared() {
  return process.env.HOD_F8_RDS_RECONCILIATION_PREPARED === 'true' && isF7WritePrepared()
}

export function requireF8Prepared() {
  if (!isF8Prepared()) throw new Error('RDS reconciliation is disabled.')
}
