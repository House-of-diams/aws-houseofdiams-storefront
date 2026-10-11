import type { QueryResult, QueryResultRow } from 'pg'

import { getPostgresErrorCode, normalizePostgresError } from '@/lib/db/errors'
import { getPool } from '@/lib/db/pool'

type QueryOptions = {
  operation?: string
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
      code: getPostgresErrorCode(error) ?? 'unknown',
    })
    throw normalizePostgresError(error)
  }
}
