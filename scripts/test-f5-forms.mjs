// F5 integration tests: real hod_app writes always ROLLBACK. Never apply DBA SQL.
// Default: execute actual route modules via TS compiler. --runtime: built Next HTTP.
import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

process.loadEnvFile('.env.local')
const require = createRequire(import.meta.url)
const modules = new Map()
function load(relative) {
  const path = resolve(relative)
  if (modules.has(path)) return modules.get(path).exports
  const compiledModule = { exports: {} }
  modules.set(path, compiledModule)
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const localRequire = (specifier) => {
    if (specifier === 'server-only') return {} // Test loader only; Next enforces the real boundary.
    if (specifier.startsWith('@/')) return load(`${specifier.slice(2)}.ts`)
    return require(specifier)
  }
  new Function('require', 'module', 'exports', source)(localRequire, compiledModule, compiledModule.exports)
  return compiledModule.exports
}

const pool = load('lib/db/pool.ts').getPool()
const scopeStore = new AsyncLocalStorage()
const writeTables = ['contact_submissions', 'newsletter_submissions', 'bespoke_submissions',
  'promotion_popup_responses', 'promotion_popup_submissions']
globalThis.__hodStorefrontPostgresPool = {
  async query(sql, values = []) {
    const scope = scopeStore.getStore()
    if (!scope) {
      assert.match(sql.trim(), /^SELECT\b/i, 'Out-of-test writes forbidden')
      return pool.query(sql, values)
    }
    assert.equal(scope.active, true, 'Query after test rollback forbidden')
    const table = sql.match(/^\s*INSERT INTO public\.([a-z_]+)/i)?.[1]
    if (table) {
      assert.ok(writeTables.includes(table), 'Unexpected write table')
      assert.doesNotMatch(sql, /\bRETURNING\b/i, 'Submission reads must not be introduced')
      assert.ok(values.length && /\$1/.test(sql), 'INSERT must use parameters')
    } else assert.match(sql.trim(), /^SELECT\b/i, 'Unexpected statement forbidden')
    const entry = { sql, values, table, rowCount: 0 }
    scope.queries.push(entry)
    let override
    try { override = await scope.intercept?.(sql, values) } catch (error) {
      entry.error = error
      throw error
    }
    if (override) { entry.result = override; return override }
    // Recover actual statement failures without changing application semantics;
    // the test transaction must continue to audit and roll back previous writes.
    await scope.client.query('SAVEPOINT f5_statement')
    try {
      const result = await scope.client.query(sql, values)
      entry.result = result
      entry.rowCount = result.rowCount
      await scope.client.query('RELEASE SAVEPOINT f5_statement')
      return result
    } catch (error) {
      entry.error = error
      await scope.client.query('ROLLBACK TO SAVEPOINT f5_statement')
      await scope.client.query('RELEASE SAVEPOINT f5_statement')
      throw error
    }
  },
}

let server, app, currentScope, pendingRequest
const runtime = process.argv.includes('--runtime')
if (runtime) {
  app = require('next')({ dev: false, dir: process.cwd(), hostname: '127.0.0.1', port: 0 })
  await app.prepare()
  const handler = app.getRequestHandler()
  server = createServer((req, res) => {
    const scope = currentScope
    if (!scope?.active || req.method !== 'POST' ||
      !/^\/api\/public\/(contact|newsletter|bespoke|promotion-popup)\/submit$/.test(req.url)) {
      res.writeHead(404).end()
      return
    }
    const finish = pendingRequest
    scopeStore.run(scope, async () => {
      try { await handler(req, res); finish.resolve() } catch (error) { finish.reject(error) }
    })
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
}

const marker = `f5-${randomUUID()}`
let ipCounter = 1, checks = 0
const ipRun = Number.parseInt(randomUUID().slice(0, 4), 16)
function ip() { const value = ipRun + ipCounter++; return `198.18.${(value >> 8) % 256}.${value % 256}:4242` }
function rows(data) { return { rows: data, rowCount: data.length } }
function failure(code) { throw Object.assign(new Error('PRIVATE_DATABASE_DETAIL_DO_NOT_LEAK'), { code }) }

// Compare the actual HTTP response to the pinned original Supabase handler.
// Its persistence and limiter are simulated using this case's observed RDS
// result/error. No Supabase request or write occurs in these parity checks.
const baselineSources = new Map()
async function baseline(form, rawBody, scope, response) {
  if (!baselineSources.has(form)) baselineSources.set(form, execFileSync('git', [
    'show', `0adad6e8b15b3fa9e6202d648a4bcecd6499a9ec:app/api/public/${form}/submit/route.ts`,
  ], { encoding: 'utf8' }))
  let index = 0
  const database = {
    from(table) {
      let insert = false
      const consume = (single) => {
        const entry = scope.queries.slice(index).find((q) => q.sql.includes(`${insert ? 'INTO' : 'FROM'} public.${table}`))
        assert.ok(entry, `Baseline requested unexpected persistence: ${table}`)
        index = scope.queries.indexOf(entry) + 1
        if (entry.error) return { data: null, error: {
          code: entry.error.code === '42P01' ? 'PGRST205' : entry.error.code,
        } }
        const result = entry.result?.rows?.map((row) => row.row ?? row) ?? []
        return { data: single ? result[0] ?? null : result, error: null }
      }
      const chain = {
        select() { return chain }, eq() { return chain }, order() { return chain },
        insert() { insert = true; return chain },
        maybeSingle() { return Promise.resolve(consume(true)) },
        then(yes, no) { return Promise.resolve(consume(false)).then(yes, no) },
      }
      return chain
    },
  }
  const baselineModule = { exports: {} }
  const source = ts.transpileModule(baselineSources.get(form), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const localRequire = (specifier) => {
    if (specifier === '@/lib/server-supabase') return { createSupabaseServiceRoleClient: () => database }
    if (specifier === '@/lib/rate-limit') return { enforceRateLimit: async () => response.status === 429
      ? { ok: false, response: new Response(JSON.stringify({ error: 'Too many requests. Please wait a bit and try again.' }), { status: 429 }) }
      : { ok: true } }
    if (specifier.startsWith('@/')) return load(`${specifier.slice(2)}.ts`)
    return require(specifier)
  }
  new Function('require', 'module', 'exports', 'console', source)(
    localRequire, baselineModule, baselineModule.exports, { ...console, error() {} },
  )
  return withEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.DATABASE_URL?.trim() ? 'test-only-provider' : undefined,
    () => baselineModule.exports.POST(new Request('http://localhost/baseline', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: rawBody })))
}
async function run(form, body, expected, options = {}) {
  const client = await pool.connect()
  const scope = { client, active: true, queries: [], intercept: options.intercept }
  try {
    await client.query('BEGIN')
    const identity = (await client.query(`SELECT current_user, rolsuper, rolbypassrls
      FROM pg_roles WHERE rolname = current_user`)).rows[0]
    assert.deepEqual(identity, { current_user: 'hod_app', rolsuper: false, rolbypassrls: false })
    const headers = { 'Content-Type': 'application/json', 'CloudFront-Viewer-Address': options.ip ?? ip() }
    const rawBody = options.raw ?? JSON.stringify(body)
    let response
    if (runtime) {
      currentScope = scope
      let resolveRequest, rejectRequest
      const done = new Promise((yes, no) => { resolveRequest = yes; rejectRequest = no })
      pendingRequest = { resolve: resolveRequest, reject: rejectRequest }
      response = await fetch(`http://127.0.0.1:${server.address().port}/api/public/${form}/submit`, {
        method: 'POST', headers, body: rawBody,
      })
      await done
    } else {
      response = await scopeStore.run(scope, () => load(`app/api/public/${form}/submit/route.ts`).POST(
        new Request(`http://localhost/api/public/${form}/submit`, { method: 'POST', headers, body: rawBody }),
      ))
    }
    const payload = await response.json()
    assert.equal(response.status, expected.status, `${form}: ${JSON.stringify(payload)}`)
    if (expected.body) assert.deepEqual(payload, expected.body)
    if (expected.verify) expected.verify(payload, response)
    assert.ok(!JSON.stringify(payload).includes('PRIVATE_DATABASE_DETAIL'), 'DB detail leaked')
    const originalResponse = await baseline(form, rawBody, scope, response)
    assert.equal(originalResponse.status, response.status, `${form}: original API status differs`)
    assert.deepEqual(await originalResponse.json(), payload, `${form}: original API JSON differs`)
    const inserts = scope.queries.filter((q) => q.table && q.rowCount === 1)
    assert.deepEqual(inserts.map((q) => q.table), expected.writes ?? [])
    if (expected.values) assert.deepEqual(inserts.map((q) => q.values), expected.values)
    const stats = (await client.query(`SELECT relname, n_tup_ins, n_tup_upd, n_tup_del
      FROM pg_stat_xact_user_tables WHERE n_tup_ins > 0 OR n_tup_upd > 0 OR n_tup_del > 0`)).rows
    for (const stat of stats) {
      assert.ok(writeTables.includes(stat.relname), 'Unexpected physical table write')
      assert.equal(Number(stat.n_tup_upd), 0, 'Unexpected update')
      assert.equal(Number(stat.n_tup_del), 0, 'Unexpected delete')
    }
    checks++
    return { payload, queries: scope.queries, inserts }
  } finally {
    try { await client.query('ROLLBACK') } finally { scope.active = false; client.release() }
  }
}

async function withEnv(key, value, callback) {
  const previous = process.env[key]
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
  try { return await callback() } finally {
    if (previous === undefined) delete process.env[key]
    else process.env[key] = previous
  }
}

async function standard(form, valid, errorMessage, limit, tests, expectedValues) {
  const table = `${form}_submissions`
  // Both equal-email requests must succeed: these tables intentionally lack email uniqueness.
  for (let duplicate = 0; duplicate < 2; duplicate++) {
    await run(form, valid, { status: 200, body: { ok: true }, writes: [table], values: [expectedValues] })
  }
  await run(form, {}, { status: 400, body: { error: 'Invalid payload.' } })
  await run(form, {}, { status: 400, body: { error: 'Invalid payload.' } }, { raw: '{' })
  await run(form, { ...valid, email: 42 }, { status: 400, body: { error: 'Invalid payload.' } })
  for (const [changes, message] of tests) await run(form, { ...valid, ...changes }, { status: 400, body: { error: message } })
  for (const code of ['42501', '23505', '23514', '23503', 'XX000']) {
    await run(form, valid, { status: 500, body: { error: errorMessage } }, {
      intercept: (sql) => { if (sql.includes(`INSERT INTO public.${table}`)) failure(code) },
    })
  }
  const address = ip()
  for (let i = 0; i < limit; i++) await run(form, {}, { status: 400 }, { ip: address })
  const limited = await run(form, valid, { status: 429, body: { error: 'Too many requests. Please wait a bit and try again.' },
    verify: (_body, response) => {
      assert.equal(response.headers.get('X-RateLimit-Limit'), String(limit))
      assert.equal(response.headers.get('X-RateLimit-Remaining'), '0')
      assert.ok(Number(response.headers.get('Retry-After')) > 0)
    } }, { ip: address })
  assert.equal(limited.queries.length, 0, 'Rate limit must stop DB access')
  await withEnv('DATABASE_URL', undefined, () => run(form, valid, { status: 503, body: {
    error: form === 'newsletter' ? 'Newsletter signup is temporarily unavailable.' : 'Form submission is temporarily unavailable.',
  } }))
  console.log(`PASS ${form}: success/duplicate, trimming/parameterization, validation, rejected storage, rate limit and configuration`)
}

async function contact() {
  const valid = { full_name: "  F5 O'Brien  ", email: `  ${marker.toUpperCase()}@EXAMPLE.INVALID  `,
    phone: '', topic: '  F5 test  ', message: "  Parameterized quote ' <b>test</b> ; SELECT 1  " }
  await standard('contact', valid, 'Unable to submit the form right now.', 5, [
    [{ full_name: ' ' }, 'Enter a valid name.'], [{ full_name: 'a'.repeat(121) }, 'Enter a valid name.'],
    [{ email: 'invalid' }, 'Enter a valid email address.'], [{ email: 'a'.repeat(255) }, 'Enter a valid email address.'],
    [{ phone: 'invalid' }, 'Enter a valid phone number.'], [{ topic: ' ' }, 'Enter a valid subject.'],
    [{ topic: 'a'.repeat(121) }, 'Enter a valid subject.'],
    [{ message: 'short' }, 'Enter a message between 10 and 5000 characters.'],
    [{ message: 'a'.repeat(5001) }, 'Enter a message between 10 and 5000 characters.'],
  ], ["F5 O'Brien", `${marker}@example.invalid`, '', 'F5 test', "Parameterized quote ' <b>test</b> ; SELECT 1"])
  const boundary = { full_name: 'a'.repeat(120), email: `${'a'.repeat(64)}@${'b'.repeat(185)}.com`,
    phone: '+91 9876543210', topic: 'a'.repeat(120), message: 'a'.repeat(5000) }
  for (const message of [boundary.message, 'a'.repeat(10)]) await run('contact', { ...boundary, message }, {
    status: 200, body: { ok: true }, writes: ['contact_submissions'],
  })
}

async function newsletter() {
  const valid = { email: `  ${marker.toUpperCase()}@EXAMPLE.INVALID  ` }
  await standard('newsletter', valid, 'Unable to subscribe right now.', 6, [
    [{ email: 'invalid' }, 'Enter a valid email address.'],
    [{ email: 'a'.repeat(255) }, 'Enter a valid email address.'],
  ], [`${marker}@example.invalid`, 'homepage_newsletter', 'new'])
  await run('newsletter', valid, { status: 503, body: { error: 'Newsletter storage is not enabled yet.' } }, {
    intercept: (sql) => { if (sql.includes('INSERT INTO public.newsletter_submissions')) failure('42P01') },
  })
  await run('newsletter', { email: `${'a'.repeat(64)}@${'b'.repeat(185)}.com` }, {
    status: 200, body: { ok: true }, writes: ['newsletter_submissions'],
  })
}

async function bespoke() {
  const valid = { full_name: '  F5 Test  ', email: `  ${marker.toUpperCase()}@EXAMPLE.INVALID  `,
    phone: '  +91 9876543210  ', country: '  India  ', piece_type: '  Ring  ',
    stone_preference: '  Diamond  ', approx_carat: '  2  ', preferred_metal: '  Gold  ', message: '  F5 bespoke test message  ' }
  await standard('bespoke', valid, 'Unable to submit the form right now.', 5, [
    [{ full_name: ' ' }, 'Enter a valid name.'], [{ full_name: 'a'.repeat(121) }, 'Enter a valid name.'],
    [{ email: 'invalid' }, 'Enter a valid email address.'], [{ email: 'a'.repeat(255) }, 'Enter a valid email address.'],
    [{ phone: 'invalid' }, 'Enter a valid phone number.'],
    [{ country: ' ' }, 'Enter a valid country.'], [{ country: 'a'.repeat(121) }, 'Enter a valid country.'],
    [{ piece_type: ' ' }, 'Enter a valid piece type.'], [{ piece_type: 'a'.repeat(121) }, 'Enter a valid piece type.'],
    [{ stone_preference: 'a'.repeat(121) }, 'One or more bespoke preferences are too long.'],
    [{ approx_carat: 'a'.repeat(81) }, 'One or more bespoke preferences are too long.'],
    [{ preferred_metal: 'a'.repeat(121) }, 'One or more bespoke preferences are too long.'],
    [{ message: 'short' }, 'Enter a message between 10 and 5000 characters.'],
    [{ message: 'a'.repeat(5001) }, 'Enter a message between 10 and 5000 characters.'],
  ], ['F5 Test', `${marker}@example.invalid`, '+91 9876543210', 'India', 'Ring', 'Diamond', '2', 'Gold', 'F5 bespoke test message', 'new'])
  await run('bespoke', { ...valid, phone: null, stone_preference: null, approx_carat: null, preferred_metal: null }, {
    status: 200, body: { ok: true }, writes: ['bespoke_submissions'], values: [[
      'F5 Test', `${marker}@example.invalid`, '', 'India', 'Ring', '', '', '', 'F5 bespoke test message', 'new',
    ]],
  })
  await run('bespoke', { ...valid, full_name: 'a'.repeat(120), country: 'a'.repeat(120), piece_type: 'a'.repeat(120),
    stone_preference: 'a'.repeat(120), approx_carat: 'a'.repeat(80), preferred_metal: 'a'.repeat(120), message: 'a'.repeat(5000) }, {
    status: 200, body: { ok: true }, writes: ['bespoke_submissions'],
  })
}

async function promotion() {
  const repo = load('lib/repositories/promotion-submissions-repository.ts')
  const live = await repo.findSubmissionPromotion()
  assert.ok(live?.is_active, 'Staging active promotion required for real writes')
  const questions = await repo.loadSubmissionQuestions(live.id)
  const liveCoupon = live.selected_coupon_id == null ? null : await repo.findSubmissionCoupon(live.selected_coupon_id)
  const email = `${marker.toUpperCase()}@EXAMPLE.INVALID`
  const answers = Object.fromEntries(questions.map((q) => {
    let value = q.input_type === 'email' ? email : q.input_type === 'phone' ? '+91 9876543210' : q.input_type === 'number' ? '25' : 'Test'
    if (q.input_type === 'options') {
      const option = q.options[0]
      value = typeof option === 'string' ? option : option.value ?? option.label ?? String(option.id ?? 0)
    }
    return [q.field_key, q.allow_multiple ? [value] : `  ${value}  `]
  }))
  const valid = { answers }
  const reveal = live.cta_action === 'reveal_coupon'
  const expectedLive = reveal ? { ok: true, action: 'reveal_coupon', coupon: { code: liveCoupon.code, title: liveCoupon.title } }
    : { ok: true, action: 'redirect', redirectUrl: live.cta_link || '/' }
  const liveWrites = ['promotion_popup_responses', ...(questions.some((q) => q.field_key === 'email') ? ['promotion_popup_submissions'] : [])]
  for (let duplicate = 0; duplicate < 2; duplicate++) {
    const result = await run('promotion-popup', valid, { status: 200, body: expectedLive, writes: liveWrites })
    const values = result.inserts[0].values
    assert.equal(values[0], live.id)
    assert.equal(values[1], `${marker}@example.invalid`)
    assert.equal(values[3], reveal)
    if (reveal) assert.ok(Number.isFinite(Date.parse(values[4])))
    else assert.equal(values[4], null)
    assert.equal(JSON.parse(values[2]).email, email, 'Answer email casing must stay unchanged')
  }

  const popup = { ...live, cta_action: 'redirect', cta_link: '/f5-test' }
  const emailQuestion = { field_key: 'email', question: 'Email address', input_type: 'email', options: [],
    allow_multiple: false, validation_pattern: null, validation_message: 'Enter a valid email address.', is_required: true }
  const override = ({ config = popup, questions: qs = [emailQuestion], coupon, errorAt, errorCode = '42501' } = {}) => (sql) => {
    if (errorAt && sql.includes(errorAt)) failure(errorCode)
    if (sql.includes('FROM public.promotion_popup WHERE')) return rows(config ? [{ row: config }] : [])
    if (sql.includes('FROM public.promotion_popup_questions')) return rows(qs)
    if (coupon !== undefined && sql.includes('FROM public.coupons')) return rows(coupon ? [{ row: coupon }] : [])
  }
  const success = { status: 200, body: { ok: true, action: 'redirect', redirectUrl: '/f5-test' },
    writes: ['promotion_popup_responses', 'promotion_popup_submissions'] }
  const legacyEmail = { email: `  ${email}  ` }
  await run('promotion-popup', legacyEmail, success, { intercept: override() })
  await run('promotion-popup', legacyEmail, success, { intercept: override({ questions: [] }) })
  await run('promotion-popup', legacyEmail, success, {
    intercept: override({ errorAt: 'FROM public.promotion_popup_questions' }),
  })
  await run('promotion-popup', legacyEmail, { ...success, body: { ...success.body, redirectUrl: '/' } }, {
    intercept: override({ config: { ...popup, cta_link: '' } }),
  })
  await run('promotion-popup', legacyEmail, success, {
    intercept: override({ config: { ...popup, cta_action: 'unknown-action' } }),
  })
  for (const config of [null, { ...popup, is_active: false }]) {
    await run('promotion-popup', legacyEmail, { status: 410, body: { error: 'This promotion is no longer available.' } }, {
      intercept: override({ config }),
    })
  }
  await run('promotion-popup', legacyEmail, { status: 410, body: { error: 'This promotion is no longer available.' } }, {
    intercept: override({ errorAt: 'FROM public.promotion_popup WHERE' }),
  })
  for (const body of [{}, { email: 'invalid' }, { answers: { email: 'a'.repeat(255) } }, { answers: [] }, null]) {
    await run('promotion-popup', body, { status: 400, body: { error: 'Enter a valid email address.', field: 'email' } }, {
      intercept: override(),
    })
  }
  await run('promotion-popup', {}, { status: 400, body: { error: 'Enter a valid email address.', field: 'email' } }, {
    raw: '{', intercept: override(),
  })
  const question = { ...emailQuestion, field_key: 'custom', question: 'Custom answer', input_type: 'text', validation_message: null }
  for (const [changes, answer, error] of [
    [{}, '', 'Custom answer is required.'], [{}, 'a'.repeat(501), 'This answer is too long.'],
    [{}, ['a', 'b'], 'Enter one answer.'],
    [{ input_type: 'phone' }, 'invalid', 'Enter a valid phone number.'],
    [{ input_type: 'number' }, 'Infinity', 'Enter a valid number.'],
    [{ validation_pattern: '^a+$' }, 'b', 'Enter a valid answer.'],
    [{ validation_pattern: '[' }, 'test', 'This question has an invalid validation rule.'],
    [{ input_type: 'options', options: ['a'] }, 'b', 'Choose a valid option.'],
    [{ input_type: 'options', options: [] }, 'a', 'Choose a valid option.'],
    [{ input_type: 'options', options: ['a', 'b'] }, ['a', 'b'], 'Choose one option.'],
  ]) {
    await run('promotion-popup', { answers: { custom: answer } }, { status: 400, body: { error, field: 'custom' } }, {
      intercept: override({ questions: [{ ...question, ...changes }] }),
    })
  }
  for (const [changes, rawAnswer, saved] of [
    [{ input_type: 'options', options: ['a', { label: 'b' }], allow_multiple: true }, [' a ', 'b', 'a', 3], ['a', 'b']],
    [{ input_type: 'number' }, ' 12.5 ', '12.5'],
    [{ input_type: 'phone' }, ' +91 9876543210 ', '+91 9876543210'],
    [{ validation_pattern: '^\\\\d+$' }, '123', '123'],
    [{ is_required: false }, '', undefined],
    [{}, 'a'.repeat(500), 'a'.repeat(500)],
  ]) {
    const result = await run('promotion-popup', { answers: { custom: rawAnswer, ignored: 'discard me' } }, {
      status: 200, body: success.body, writes: ['promotion_popup_responses'],
    }, { intercept: override({ questions: [{ ...question, ...changes }] }) })
    assert.deepEqual(JSON.parse(result.inserts[0].values[2]), saved === undefined ? {} : { custom: saved })
    assert.equal(result.inserts[0].values[1], null)
  }

  const revealPopup = { ...popup, cta_action: 'reveal_coupon', selected_coupon_id: live.selected_coupon_id }
  assert.ok(liveCoupon, 'Staging coupon needed for live reveal test')
  for (const coupon of [null, { ...liveCoupon, is_active: false },
    { ...liveCoupon, starts_at: new Date(Date.now() + 86_400_000).toISOString() },
    { ...liveCoupon, ends_at: new Date(Date.now() - 1).toISOString() },
    { ...liveCoupon, usage_limit: 2, usage_count: 2 }]) {
    await run('promotion-popup', legacyEmail, { status: 410, body: { error: 'This coupon is no longer available.' } }, {
      intercept: override({ config: revealPopup, coupon }),
    })
  }
  for (const scenario of [{ config: { ...revealPopup, selected_coupon_id: null } },
    { config: revealPopup, errorAt: 'FROM public.coupons' }]) {
    await run('promotion-popup', legacyEmail, { status: 410, body: { error: 'This coupon is no longer available.' } }, {
      intercept: override(scenario),
    })
  }
  for (const code of ['42501', '23505']) {
    await run('promotion-popup', legacyEmail, { status: 500, body: { error: 'Unable to save your answers. Please try again.' } }, {
      intercept: override({ errorAt: 'INSERT INTO public.promotion_popup_responses', errorCode: code }),
    })
    await run('promotion-popup', legacyEmail, { ...success, writes: ['promotion_popup_responses'] }, {
      intercept: override({ errorAt: 'INSERT INTO public.promotion_popup_submissions', errorCode: code }),
    })
  }
  await run('promotion-popup', legacyEmail, { status: 200,
    body: { ok: true, action: 'reveal_coupon', coupon: { code: liveCoupon.code, title: liveCoupon.title } },
    writes: ['promotion_popup_responses'],
  }, { intercept: override({ config: revealPopup, errorAt: 'INSERT INTO public.promotion_popup_submissions' }) })
  // Real CHECK rejection of the best-effort record: custom text email answers
  // retain the old behavior instead of gaining a new validation requirement.
  await run('promotion-popup', { answers: { email: 'x' } }, { ...success, writes: ['promotion_popup_responses'] }, {
    intercept: override({ questions: [{ ...emailQuestion, input_type: 'text' }] }),
  })
  // Real revised RLS rejection, with no persistent popup edits or master role.
  await run('promotion-popup', legacyEmail, { status: 500, body: { error: 'Unable to save your answers. Please try again.' } }, {
    intercept: override({ config: { ...popup, id: -1 } }),
  })
  const address = ip()
  for (let i = 0; i < 5; i++) await run('promotion-popup', {}, { status: 400 }, { ip: address, intercept: override() })
  const limited = await run('promotion-popup', valid, { status: 429, body: {
    error: 'Too many requests. Please wait a bit and try again.',
  } }, { ip: address })
  assert.equal(limited.queries.length, 0)
  await withEnv('DATABASE_URL', undefined, () => run('promotion-popup', valid, { status: 503, body: {
    error: 'Promotion response collection is not configured.',
  } }))
  console.log('PASS promotion: live reveal/duplicate, redirect, fallback, question validation, coupon eligibility, RLS rejection, best-effort secondary record and rate limit')
}

try {
  const forms = process.argv.filter((arg) => ['contact', 'newsletter', 'bespoke', 'promotion-popup'].includes(arg))
  if (!forms.length) forms.push('contact')
  for (const form of forms) {
    if (form === 'contact') await contact()
    else if (form === 'newsletter') await newsletter()
    else if (form === 'bespoke') await bespoke()
    else if (form === 'promotion-popup') await promotion()
    else throw new Error(`Form test not implemented: ${form}`)
  }
  if (process.env.REDIS_URL?.trim()) assert.ok(globalThis.__hodRedisClient?.isReady, 'Configured Redis must be used')
  console.log(`PASS ${checks} ${runtime ? 'production Next HTTP' : 'route-module'} cases as hod_app; all DB transactions rolled back; rate-limit backend: ${globalThis.__hodRedisClient?.isReady ? 'Redis' : 'existing memory fallback (REDIS_URL unset)'}.`)
} finally {
  if (server) await new Promise((done) => server.close(done))
  if (app) await app.close()
  if (globalThis.__hodRedisClient) await globalThis.__hodRedisClient.quit()
  delete globalThis.__hodStorefrontPostgresPool
  await pool.end()
}
