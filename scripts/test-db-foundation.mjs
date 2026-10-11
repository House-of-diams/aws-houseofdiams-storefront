import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DatabaseError,
  normalizePostgresError,
} from '../lib/db/errors.ts'

test('normalizes expected PostgreSQL errors without exposing database details', () => {
  const cases = [
    ['23505', 'conflict', 409],
    ['23503', 'foreign_key_violation', 409],
    ['23514', 'check_violation', 400],
    ['42501', 'insufficient_privilege', 500],
    ['P0002', 'not_found', 404],
    ['PT409', 'conflict', 409],
    ['22023', 'invalid_parameter', 400],
  ]

  for (const [code, expectedKind, expectedStatus] of cases) {
    const source = Object.assign(new Error('sensitive database detail'), { code })
    const normalized = normalizePostgresError(source)

    assert.ok(normalized instanceof DatabaseError)
    assert.equal(normalized.code, code)
    assert.equal(normalized.kind, expectedKind)
    assert.equal(normalized.status, expectedStatus)
    assert.doesNotMatch(normalized.message, /sensitive database detail/)
  }
})

test('normalizes unknown values to a generic internal database error', () => {
  const normalized = normalizePostgresError({ password: 'must-not-leak' })

  assert.equal(normalized.code, null)
  assert.equal(normalized.kind, 'database_error')
  assert.equal(normalized.status, 500)
  assert.doesNotMatch(normalized.message, /must-not-leak/)
})

test('preserves an already-normalized database error', () => {
  const original = new DatabaseError({
    code: 'PT409',
    kind: 'conflict',
    status: 409,
    message: 'Conflict.',
  })

  assert.equal(normalizePostgresError(original), original)
})
