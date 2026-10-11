import { normalizePostgresError, type DatabaseErrorKind } from '@/lib/db/errors'
import { query } from '@/lib/db/query'

export type DatabaseReadiness =
  | { ok: true; latencyMs: number }
  | { ok: false; latencyMs: number; reason: DatabaseErrorKind }

export async function checkDatabaseReadiness(): Promise<DatabaseReadiness> {
  const startedAt = performance.now()

  try {
    const result = await query<{ ok: number }>('SELECT $1::integer AS ok', [1], {
      operation: 'database-readiness',
    })
    const latencyMs = Math.round(performance.now() - startedAt)

    if (result.rows[0]?.ok !== 1) {
      return { ok: false, latencyMs, reason: 'database_error' }
    }

    return { ok: true, latencyMs }
  } catch (error) {
    const normalizedError = normalizePostgresError(error)
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - startedAt),
      reason: normalizedError.kind,
    }
  }
}
