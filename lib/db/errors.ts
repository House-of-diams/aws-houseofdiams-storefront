const POSTGRES_ERROR_DEFINITIONS = {
  '23505': { kind: 'conflict', status: 409, message: 'The requested record conflicts with existing data.' },
  '23503': { kind: 'foreign_key_violation', status: 409, message: 'The requested operation conflicts with related data.' },
  '23514': { kind: 'check_violation', status: 400, message: 'The requested data is invalid.' },
  '42501': { kind: 'insufficient_privilege', status: 500, message: 'The database operation could not be completed.' },
  P0002: { kind: 'not_found', status: 404, message: 'The requested record was not found.' },
  PT409: { kind: 'conflict', status: 409, message: 'The requested operation conflicts with the current state.' },
  '22023': { kind: 'invalid_parameter', status: 400, message: 'The requested data is invalid.' },
} as const

type KnownPostgresCode = keyof typeof POSTGRES_ERROR_DEFINITIONS
export type DatabaseErrorKind =
  | (typeof POSTGRES_ERROR_DEFINITIONS)[KnownPostgresCode]['kind']
  | 'database_error'

type ErrorWithCode = Error & { code?: unknown }

export class DatabaseError extends Error {
  readonly code: string | null
  readonly kind: DatabaseErrorKind
  readonly status: number

  constructor(options: {
    code: string | null
    kind: DatabaseErrorKind
    status: number
    message: string
    cause?: unknown
  }) {
    super(options.message, { cause: options.cause })
    this.name = 'DatabaseError'
    this.code = options.code
    this.kind = options.kind
    this.status = options.status
  }
}

export function getPostgresErrorCode(error: unknown) {
  if (!(error instanceof Error)) return null
  const code = (error as ErrorWithCode).code
  return typeof code === 'string' ? code : null
}

export function normalizePostgresError(error: unknown) {
  if (error instanceof DatabaseError) return error

  const code = getPostgresErrorCode(error)
  const definition = code && code in POSTGRES_ERROR_DEFINITIONS
    ? POSTGRES_ERROR_DEFINITIONS[code as KnownPostgresCode]
    : null

  return new DatabaseError({
    code,
    kind: definition?.kind ?? 'database_error',
    status: definition?.status ?? 500,
    message: definition?.message ?? 'The database operation could not be completed.',
    cause: error,
  })
}
