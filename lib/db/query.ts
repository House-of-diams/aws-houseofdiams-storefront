import type { QueryResult, QueryResultRow } from 'pg'

import { getPostgresErrorCode, normalizePostgresError } from '@/lib/db/errors'
import { getPool } from '@/lib/db/pool'

type QueryOptions = {
  operation?: string
}

// Connection-level failures from `pg` carry no PostgreSQL code; name the
// common ones so logs say why instead of "unknown".
function describeUncodedError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('timeout exceeded when trying to connect')) return 'pool_wait_timeout'
  if (message.includes('Connection terminated')) return 'connection_terminated'
  if (message.includes('ECONNREFUSED')) return 'connection_refused'
  return 'unknown'
}

export async function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
  options: QueryOptions = {},
): Promise<QueryResult<Row>> {
  try {
    return await getPool().query<Row>(text, [...values])
  } catch (error) {
    console.error('[db] Query failed.', {
      operation: options.operation ?? 'unnamed',
      code: getPostgresErrorCode(error) ?? describeUncodedError(error),
    })
    throw normalizePostgresError(error)
  }
}
