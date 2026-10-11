import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// No ENV loading, network, database, or provider access is possible.
function load(path, stubs = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const exports = {}
  new Function('require', 'exports', js)((name) => {
    if (name === 'server-only') return {}
    if (Object.hasOwn(stubs, name)) return stubs[name]
    throw new Error(`Unmocked dependency: ${name}`)
  }, exports)
  return exports
}
const action = { id: 'action-test', order_id: 'order-test', payment_id: 'pay-test', amount_subunits: '740',
  currency: 'JPY', provider_refund_id: null, attempt_count: 2, leased_until: new Date(Date.now() + 300_000).toISOString() }
const order = { payment_gateway: 'razorpay', razorpay_order_id: 'gateway-test', payment_status: 'pending',
  payment_amount: '740', payment_currency: 'JPY' }
const payment = { id: 'pay-test', order_id: 'gateway-test', status: 'captured', amount: 740, currency: 'JPY' }
const refund = { id: 'refund-test', payment_id: 'pay-test', amount: 740, currency: 'JPY',
  receipt: 'recovery-action-test', status: 'processed' }
const subunits = load('lib/payment-subunits.ts')
function fixture(options = {}) {
  const writes = []; const calls = []; const finalizations = []
  const services = load('lib/f8-reconciliation.ts', {
    '@/lib/f8-prepared': { requireF8Prepared: () => { if (options.disabled) throw new Error('disabled') } },
    '@/lib/payment-subunits': subunits,
    '@/lib/f7-payment': {
      finalizeF7Payment: async (input) => { calls.push('finalize'); finalizations.push(input); if (options.finalizationThrows) throw new Error('secret')
        return options.finalization ?? { error: 'Rejected fixture', errorCode: 'permanent_failure' } },
      recoverF7CapturedPayment: async () => { calls.push('queue'); return options.recovery ?? { durable: true } },
    },
    '@/lib/razorpay': { getRazorpayClient: () => ({ payments: {
      fetch: async () => { calls.push('payment'); if (options.providerError) throw new Error('secret'); return { ...payment, ...options.payment } },
      fetchRefund: async () => { calls.push('refund'); return { ...refund, ...options.refund } },
      fetchMultipleRefund: async () => { calls.push('list'); return { items: options.refunds ?? [{ ...refund, ...options.refund }] } },
      refund: async () => { throw new Error('A reconciliation test must never issue a refund') },
    }, orders: { fetchPayments: async () => { calls.push('list-payments')
      if (options.providerError) throw new Error('secret')
      return { items: options.payments ?? [], count: options.paymentCount ?? (options.payments ?? []).length } } } }) },
    '@/lib/repositories/reconciliation-repository': {
      loadRdsRecoveryOrder: async () => options.missingOrder ? null : { ...order, ...options.order },
      finishRdsRecovery: async (claimed, result) => { writes.push({ claimed, result });
        if (options.persistenceError) throw new Error('private database error'); return !options.leaseLost },
      expireRdsReservations: async () => { calls.push('expire'); if (options.expiryError) throw new Error('expiry'); return 0 },
      claimDueRdsRecovery: async () => { calls.push('claim'); return options.actions ?? [action] },
      claimRdsPendingOrders: async () => options.pendingOrders ?? [],
      finishRdsPendingOrder: async (claimed, result) => { writes.push({ claimed, result })
        if (options.persistenceError) throw new Error('database secret'); return !options.leaseLost },
      countRdsRecoveryAttention: async () => options.attention ?? 0,
      escalateRdsExhaustedRecovery: async () => 0,
      deferRdsRecovery: async () => true,
    },
  })
  return { services, writes, calls, finalizations }
}

test('F8 gate defaults OFF and requires both F7 flags', () => {
  const f7 = load('lib/f7-write-prepared.ts')
  const flags = load('lib/f8-prepared.ts', { '@/lib/f7-write-prepared': f7 })
  for (const [auth, write, cron, expected] of [['', '', '', false], ['true', 'true', '', false],
    ['', 'true', 'true', false], ['true', '', 'true', false], ['true', 'true', 'true', true]]) {
    process.env.HOD_CUSTOMER_AUTH_ENABLED = auth; process.env.HOD_F7_RDS_WRITE_PREPARED = write
    process.env.HOD_F8_RDS_RECONCILIATION_PREPARED = cron
    assert.equal(flags.isF8Prepared(), expected)
    if (!expected) assert.throws(flags.requireF8Prepared)
  }
})
test('JPY exact subunits and existing processed refund reconcile without a new refund', async () => {
  const f = fixture(); assert.equal(await f.services.reconcileRdsRecovery(action), 'refunded')
  assert.equal(f.writes[0].result.refundId, refund.id)
})
for (const [label, options] of [
  ['missing order', { missingOrder: true }], ['paid order', { order: { payment_status: 'paid' } }],
  ['order amount', { order: { payment_amount: '741' } }], ['order currency', { order: { payment_currency: 'USD' } }],
  ['payment order', { payment: { order_id: 'other' } }], ['payment ID', { payment: { id: 'other' } }],
  ['payment amount', { payment: { amount: 741 } }], ['payment currency', { payment: { currency: 'USD' } }],
  ['uncaptured', { payment: { status: 'authorized' } }], ['refund payment', { refund: { payment_id: 'other' } }],
  ['refund amount', { refund: { amount: 1 } }], ['refund currency', { refund: { currency: 'USD' } }],
  ['missing refund', { refunds: [] }], ['duplicate refund', { refunds: [refund, refund] }],
]) test(`${label} goes to review without issuing a refund`, async () => {
  const f = fixture(options); assert.equal(await f.services.reconcileRdsRecovery(action), 'manual_review')
})
test('known refund ID is verified and terminal refunded payments are accepted', async () => {
  const f = fixture({ payment: { status: 'refunded' } })
  assert.equal(await f.services.reconcileRdsRecovery({ ...action, provider_refund_id: refund.id }), 'refunded')
  assert.deepEqual(f.calls, ['payment', 'refund'])
  assert.equal(await fixture({ refund: { id: 'other' } }).services.reconcileRdsRecovery({ ...action, provider_refund_id: refund.id }), 'manual_review')
})
test('pending refund retries are bounded and failed refunds require review', async () => {
  assert.equal(await fixture({ refund: { status: 'pending' } }).services.reconcileRdsRecovery(action), 'refund_pending')
  assert.equal(await fixture({ refund: { status: 'pending' } }).services.reconcileRdsRecovery({ ...action, attempt_count: 8 }), 'manual_review')
  assert.equal(await fixture({ refund: { status: 'failed' } }).services.reconcileRdsRecovery(action), 'manual_review')
})
test('provider failure stores generic errors; final attempt requires review', async () => {
  const f = fixture({ providerError: true }); assert.equal(await f.services.reconcileRdsRecovery(action), 'failed')
  assert.equal(f.writes[0].result.lastError.includes('secret'), false)
  assert.equal(await f.services.reconcileRdsRecovery({ ...action, attempt_count: 8 }), 'manual_review')
})
test('lost lease cannot report a persisted outcome and write failure rejects', async () => {
  assert.equal(await fixture({ leaseLost: true }).services.reconcileRdsRecovery(action), 'lease_lost')
  await assert.rejects(fixture({ persistenceError: true }).services.reconcileRdsRecovery(action))
})
test('worker isolates failed writes, reports backlog and stops before claiming on expiry failure', async () => {
  const f = fixture({ actions: [action, action], persistenceError: true, attention: 3 })
  const summary = await f.services.runRdsReconciliation()
  assert.equal(summary.ok, false); assert.equal(summary.failed, 2); assert.equal(summary.attention, 3)
  const expiry = fixture({ expiryError: true }); await assert.rejects(expiry.services.runRdsReconciliation())
  assert.deepEqual(expiry.calls, ['expire'])
})
test('repository parameters bind lease generation and protect terminal results', async () => {
  const calls = []
  const repo = load('lib/repositories/reconciliation-repository.ts', {
    '@/lib/f8-prepared': { requireF8Prepared: () => {} },
    '@/lib/db/query': { query: async (...args) => { calls.push(args); return { rowCount: 0, rows: [] } } },
  })
  assert.equal(await repo.finishRdsRecovery(action, { status: 'refunded', lastError: null, refundId: refund.id,
    nextAttemptAt: new Date().toISOString() }), false)
  assert.match(calls[0][0], /attempt_count = \$6 and leased_until = \$7/)
  assert.match(calls[0][0], /leased_until > now\(\)/)
  assert.match(calls[0][0], /status in \('processing', 'refund_pending', 'failed'\)/)
  assert.deepEqual(calls[0][1].slice(-2), [action.attempt_count, action.leased_until])
  await repo.claimDueRdsRecovery(); await repo.expireRdsReservations()
  assert.match(calls[1][0], /leased_until::text as leased_until/)
  assert.deepEqual(calls[1][1], [20]); assert.deepEqual(calls[2][1], [1000])
})
test('cron authenticates first, blocks cross-ledger fallback and returns failure status', async () => {
  let prepared = false; let f7 = true; let runs = 0
  process.env.CRON_SECRET = 'synthetic-test-secret'; process.env.HOD_F8_RDS_RECONCILIATION_PREPARED = ''
  const route = load('app/api/cron/payment-reconciliation/route.ts', {
    '@supabase/supabase-js': { createClient: () => { throw new Error('Legacy ledger must not be reached') } },
    '@/lib/payment-recovery': {}, '@/lib/f7-write-prepared': { isF7WritePrepared: () => f7 },
    '@/lib/f8-prepared': { isF8Prepared: () => prepared },
    '@/lib/f8-reconciliation': { runRdsReconciliation: async () => { runs++; return { ok: false } } },
  })
  const request = (authorized) => new Request('https://test/cron', { headers: authorized ? { authorization: 'Bearer synthetic-test-secret' } : {} })
  assert.equal((await route.GET(request(false))).status, 401); assert.equal(runs, 0)
  assert.equal((await route.GET(request(true))).status, 503); assert.equal(runs, 0)
  f7 = false; process.env.HOD_F8_RDS_RECONCILIATION_PREPARED = 'true'
  assert.equal((await route.GET(request(true))).status, 503)
  prepared = true; assert.equal((await route.GET(request(true))).status, 503); assert.equal(runs, 1)
})
test('refund webhook matches refund and payment and cannot regress refunded', async () => {
  const calls = []
  const repository = load('lib/repositories/payment-repository.ts', {
    '@/lib/db/query': { query: async (...args) => { calls.push(args); return { rows: [], rowCount: 0 } } },
    '@/lib/db/transaction': {}, '@/lib/f7-write-prepared': { requireF7WritePrepared: () => {} },
    '@/lib/repositories/checkout-repository': {},
  })
  await repository.recordRdsRefundEvent({ refundId: 'refund-other', paymentId: action.payment_id, status: 'failed' })
  assert.match(calls[0][0], /and provider_refund_id = \$1/)
  assert.match(calls[0][0], /and \(\$2::text is null or payment_id = \$2\)/)
  assert.match(calls[0][0], /and status <> 'refunded'/)
  assert.deepEqual(calls[0][1], ['refund-other', action.payment_id, 'failed'])
})

const discovery = { id:'order-test',razorpay_order_id:'gateway-test',payment_amount:'740',payment_currency:'JPY',
  payment_status:'pending',status:'pending',lease_token:'lease-test',deadline_passed:true }
test('missing-ledger captured payment is independently fetched and finalized with exact JPY',async()=> {
  const f=fixture({payments:[payment],finalization:{data:{orderId:discovery.id}}})
  assert.equal(await f.services.reconcileRdsPendingOrder(discovery),'paid')
  assert.deepEqual(f.calls,['list-payments','payment','finalize'])
  assert.equal(f.finalizations[0].paymentAmountInSubunits,740)
})
test('provider-confirmed no payment expires after the existing 15-minute window; fresh remains pending',async()=> {
  const f=fixture(); assert.equal(await f.services.reconcileRdsPendingOrder(discovery),'expired')
  assert.equal(f.writes[0].result.expire,true)
  const fresh=fixture(); assert.equal(await fresh.services.reconcileRdsPendingOrder({...discovery,deadline_passed:false}),'pending')
  assert.equal(fresh.writes[0].result.expire,false)
})
test('authorized payments are deferred without capture, expiry, or refund',async()=> {
  const f=fixture({payments:[{...payment,status:'authorized'}]})
  assert.equal(await f.services.reconcileRdsPendingOrder(discovery),'awaiting_capture')
  assert.deepEqual(f.calls,['list-payments']); assert.equal(f.writes[0].result.expire,false)
})
for(const [label,options] of [
  ['wrong listed order',{payments:[{...payment,order_id:'other'}]}],
  ['unknown state',{payments:[{...payment,status:'unknown'}]}],
  ['incomplete listing',{payments:[payment],paymentCount:2}],
  ['multiple captures',{payments:[payment,{...payment,id:'other'}]}],
  ['partial refund',{payments:[{...payment,amount_refunded:1}]}],
  ['full refund',{payments:[{...payment,status:'refunded'}]}],
  ['fresh amount mismatch',{payments:[payment],payment:{amount:741}}],
  ['fresh order mismatch',{payments:[payment],payment:{order_id:'other'}}],
  ['fresh currency mismatch',{payments:[payment],payment:{currency:'USD'}}],
  ['fresh partial refund',{payments:[payment],payment:{amount_refunded:1}}],
]) test(`discovery ${label} requires review before finalization`,async()=> {
  const f=fixture(options); assert.equal(await f.services.reconcileRdsPendingOrder(discovery),'manual_review')
  assert.equal(f.calls.includes('finalize'),false); assert.equal(f.writes[0].result.review,true)
})
test('discovery transport error queues durable recovery; nondurable queue reports failure',async()=> {
  const opts={payments:[payment],finalization:{error:'transport',errorCode:'finalization_rpc_error'}}
  assert.equal(await fixture(opts).services.reconcileRdsPendingOrder(discovery),'recovery_queued')
  assert.equal(await fixture({...opts,recovery:{durable:false}}).services.reconcileRdsPendingOrder(discovery),'failed')
  assert.equal(await fixture({payments:[payment]}).services.reconcileRdsPendingOrder(discovery),'manual_review')
})
test('discovery provider outage never expires an order and lost lease is reported',async()=> {
  const f=fixture({providerError:true}); assert.equal(await f.services.reconcileRdsPendingOrder(discovery),'failed')
  assert.equal(f.writes[0].result.expire,false)
  assert.equal(await fixture({leaseLost:true}).services.reconcileRdsPendingOrder(discovery),'lease_lost')
})
test('recovery without a refund retries verified finalization and preserves review for closure',async()=> {
  const f=fixture({refunds:[],finalization:{data:{orderId:discovery.id}}})
  assert.equal(await f.services.reconcileRdsRecovery(action),'manual_review')
  assert.equal(f.calls.includes('finalize'),true); assert.match(f.writes[0].result.lastError,/no refund issued/)
  const retry=fixture({refunds:[],finalization:{error:'transport',errorCode:'finalization_rpc_error'}})
  assert.equal(await retry.services.reconcileRdsRecovery(action),'failed')
})
test('provider read timeout rejects promptly; timed-out reads cannot issue payments',async()=> {
  const f=fixture()
  await assert.rejects(f.services.withF8ProviderTimeout(()=>new Promise(()=>{}),10),/timed out/)
})
test('recovery deferral preserves lease comparison and restores the unconsumed attempt',async()=> {
  const calls=[]
  const repo=load('lib/repositories/reconciliation-repository.ts',{
    '@/lib/f8-prepared':{requireF8Prepared:()=>{}},
    '@/lib/db/query':{query:async(...args)=>{calls.push(args);return {rowCount:1,rows:[]}}},
  })
  assert.equal(await repo.deferRdsRecovery(action),true)
  assert.match(calls[0][0],/attempt_count = greatest\(1, attempt_count - 1\)/)
  assert.match(calls[0][0],/leased_until = \$3::timestamptz/)
  assert.deepEqual(calls[0][1],[action.id,action.attempt_count,action.leased_until])
})
