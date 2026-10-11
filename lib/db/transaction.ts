import type { PoolClient } from 'pg'

import { getPostgresErrorCode, normalizePostgresError } from '@/lib/db/errors'
import { getPool } from '@/lib/db/pool'

export async function withTransaction<Result>(
  callback: (client: PoolClient) => Promise<Result>,
): Promise<Result> {
  const client = await getPool().connect().catch((error: unknown) => {
    throw normalizePostgresError(error)
  })
  let transactionStarted = false

  try {
    await client.query('BEGIN')
    transactionStarted = true
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        console.error('[db] Transaction rollback failed.', {
          code: getPostgresErrorCode(rollbackError) ?? 'unknown',
        })
      }
    }

    throw normalizePostgresError(error)
  } finally {
    client.release()
  }
}
