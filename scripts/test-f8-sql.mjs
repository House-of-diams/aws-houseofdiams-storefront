import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { randomUUID, randomBytes } from 'node:crypto'
import { checkServerIdentity } from 'node:tls'
import pg from 'pg'
import ts from 'typescript'

// Real application-role SQL against the isolated clone ONLY. No provider SDK,
// email, privileged role, schema mutation, or existing-data deletion is used.
// Most fixtures roll back. Concurrency fixtures are retained, explicitly tagged.
process.loadEnvFile('.env.local')
const url = new URL(process.env.F8_TEST_DATABASE_URL || process.env.DATABASE_URL)
if (!process.env.F8_TEST_DATABASE_URL) url.pathname = '/hod_f7_test'
assert.equal(decodeURIComponent(url.pathname), '/hod_f7_test')
assert.equal(decodeURIComponent(url.username), 'hod_app')
const expectedHost = process.env.DB_TLS_EXPECTED_HOST
assert.ok(expectedHost && process.env.DB_CA_CERT_PATH)
url.hostname = expectedHost; url.port = '5432'
for (const key of ['sslmode','sslcert','sslkey','sslrootcert','options']) url.searchParams.delete(key)
const config = { connectionString: url.toString(), connectionTimeoutMillis: 15000,
  options: '-c statement_timeout=15000 -c lock_timeout=10000',
  ssl: { rejectUnauthorized: true, ca: readFileSync(process.env.DB_CA_CERT_PATH, 'utf8'),
    checkServerIdentity: (_host, cert) => checkServerIdentity(expectedHost, cert) } }
const run = `F8_SYNTHETIC:${randomUUID()}`
const retained = []
const retainedEvents = []
const protectedTables = ['orders','order_items','coupons','products','checkout_attempts','payment_recovery_actions','payment_webhook_events','order_status_history']
const baseline = new Map()
const nativeRequire = createRequire(import.meta.url)
function load(path, stubs = {}) {
  const js = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const exports = {}
  new Function('require','exports',js)((name) => {
    if (name === 'server-only') return {}
    if (Object.hasOwn(stubs,name)) return stubs[name]
    if (name.startsWith('node:')) return nativeRequire(name)
    throw new Error(`Unmocked external dependency: ${name}`)
  },exports)
  return exports
}
async function connect() {
  const client = new pg.Client(config); await client.connect()
  const identity = (await client.query(`select current_database() db, current_user role,
    (select rolsuper or rolbypassrls from pg_roles where rolname=current_user) privileged`)).rows[0]
  assert.deepEqual(identity, { db:'hod_f7_test', role:'hod_app', privileged:false })
  return client
}
async function begin(client) {
  await client.query('BEGIN')
  assert.equal((await client.query('select current_database() db')).rows[0].db,'hod_f7_test')
}
function modules(client) {
  const q = { query: (sql,values=[]) => client.query(sql,values) }
  const tx = { withTransaction: (callback) => callback(client) }
  const flags = { requireF7WritePrepared: () => {}, requireF8Prepared: () => {} }
  const checkout = load('lib/repositories/checkout-repository.ts', {
    '@/lib/db/query':q, '@/lib/db/transaction':tx, '@/lib/f7-write-prepared':flags,
  })
  const payment = load('lib/repositories/payment-repository.ts', {
    '@/lib/db/query':q, '@/lib/db/transaction':tx, '@/lib/f7-write-prepared':flags,
    '@/lib/repositories/checkout-repository':checkout,
  })
  const reconciliation = load('lib/repositories/reconciliation-repository.ts', {
    '@/lib/db/query':q, '@/lib/f8-prepared':flags,
  })
  return { checkout,payment,reconciliation }
}
async function fixture(client, options={}) {
  const product = (await client.query(`select id,name,slug,stock_quantity from public.products
    where status='active' and ($1::boolean = false or stock_quantity >= 3)
    order by stock_quantity, id limit 1`,[options.legacy??false])).rows[0]
  assert.ok(product)
  const gatewayId = `order_f8_synthetic_${randomUUID()}`
  const hash = randomBytes(32).toString('hex')
  const payload = { fulfillment_mode:options.legacy?'legacy_stock':'made_to_order', guest_token_hash:hash,
    customer_email:'f8-synthetic@example.invalid', customer_first_name:'F8 synthetic test',
    subtotal_amount:100, gst_amount:12, shipping_amount:0,total_amount:112,
    payment_amount:options.currency==='USD' ? 112 : 740,payment_currency:options.currency||'JPY',
    razorpay_order_id:gatewayId,notes:run, gateway_payload:options.payload||{} }
  const lines = [{ product_id:product.id,product_name:product.name,product_slug:product.slug,quantity:1,
    unit_price:100,line_total:100,gst_percentage:12,gst_amount:12 }]
  if (options.gift) lines.push({ product_id:options.gift.product_id, product_name:'Synthetic free gift',
    quantity:1,unit_price:0,line_total:0,gst_amount:0,item_type:'free_gift',promotion_coupon_id:options.gift.coupon_id,
    original_unit_price:100 })
  const created = await modules(client).checkout.createRdsPendingOrder({ order:payload,items:lines,
    loveLetter:null,birthDate:null,anniversaryDate:null })
  assert.ok(created?.id)
  const result = { id:created.id, gatewayId, hash, product, paymentId:`pay_f8_synthetic_${randomUUID()}`,
    amount:payload.payment_currency==='JPY'?740:11200, currency:payload.payment_currency }
  const stock = (await client.query('select stock_quantity from public.products where id=$1',[product.id])).rows[0].stock_quantity
  assert.equal(stock,product.stock_quantity-(options.legacy?1:0),'creation preserves the installed fulfillment policy')
  if (!options.legacy) {
    assert.equal((await client.query('select public.release_order_inventory_reservation($1::uuid) n',[created.id])).rows[0].n,0,
      'made-to-order creation must produce zero active physical reservations')
  }
  return result
}
const input = (f,overrides={}) => ({ orderId:f.id,razorpayOrderId:f.gatewayId,paymentId:f.paymentId,
  gatewayPaymentStatus:'captured',paymentAmountInSubunits:f.amount,paymentCurrency:f.currency,...overrides })
function services(client,f,options={}) {
  const repos=modules(client)
  const f7=load('lib/f7-payment.ts', {
    '@/lib/email': { sendOrderConfirmationEmail: async()=>{} },
    '@/lib/repositories/payment-repository':repos.payment,
  })
  const captured={id:f.paymentId,order_id:f.gatewayId,amount:f.amount,currency:f.currency,status:'captured',amount_refunded:0}
  const provider={orders:{fetchPayments:async()=>({items:options.payments??[captured],count:(options.payments??[captured]).length})},
    payments:{fetch:async()=>captured,fetchMultipleRefund:async()=>({items:[]}),refund:async()=>{throw new Error('Live operations are forbidden')}}}
  return load('lib/f8-reconciliation.ts', {
    '@/lib/f8-prepared':{requireF8Prepared:()=>{}},'@/lib/razorpay':{getRazorpayClient:()=>provider},
    '@/lib/payment-subunits':load('lib/payment-subunits.ts'), '@/lib/f7-payment':f7,
    '@/lib/repositories/reconciliation-repository':repos.reconciliation,
  })
}
async function rollbackTest(callback) {
  const client = await connect()
  try { await begin(client); await callback(client,modules(client)) }
  finally { await client.query('ROLLBACK'); await client.end() }
}
async function committedFixture(options={}) {
  const client=await connect()
  try {
    await begin(client); const f=await fixture(client,options)
    await client.query('COMMIT'); retained.push(f.id); return f
  } catch(error) { await client.query('ROLLBACK'); throw error }
  finally { await client.end() }
}
async function blocked(observer, pid, blocker) {
  for(let i=0;i<80;i++) {
    if ((await observer.query('select $2::integer = any(pg_blocking_pids($1::integer)) blocked',[pid,blocker])).rows[0].blocked) return
    await new Promise((resolve)=>setTimeout(resolve,25))
  }
  throw new Error('Expected concurrent operation did not wait on the fixture row')
}

test.before(async()=> {
  const client=await connect()
  try {
    await client.query('BEGIN READ ONLY')
    // Fixed, code-owned whitelist; no external SQL identifiers are interpolated.
    for(const table of protectedTables) {
      const ids=(await client.query(`select id::text id from public.${table} order by id`)).rows.map((row)=>row.id)
      const digest=(await client.query(`select md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by t.id::text),'')) digest
        from public.${table} t where t.id::text = any($1::text[])`,[ids])).rows[0].digest
      baseline.set(table,{ids,digest})
    }
    await client.query('ROLLBACK')
  } finally { await client.end() }
})

test('real JPY/USD finalization checks, duplicate payment IDs and made-to-order stock',async()=> {
  await rollbackTest(async(client,{payment})=> {
    for(const currency of ['JPY','USD']) {
      const f=await fixture(client,{currency})
      for(const [override,code] of [
        [{paymentAmountInSubunits:f.amount+1},'payment_amount_mismatch'],
        [{paymentCurrency:'EUR'},'payment_currency_mismatch'],
        [{gatewayPaymentStatus:'authorized'},'payment_not_captured'],
      ]) assert.equal((await payment.finalizeRdsOrder(input(f,override))).result.error_code,code)
      assert.equal(await payment.finalizeRdsOrder(input(f,{razorpayOrderId:'wrong'})),null)
      const paid=await payment.finalizeRdsOrder(input(f)); assert.equal(paid.result.ok,true)
      assert.equal((await payment.finalizeRdsOrder(input(f))).result.already_paid,true)
      assert.equal((await payment.finalizeRdsOrder(input(f,{paymentId:'other'}))).result.error_code,'payment_id_mismatch')
      assert.equal((await client.query('select stock_quantity from public.products where id=$1',[f.product.id])).rows[0].stock_quantity,f.product.stock_quantity)
      assert.ok((await client.query('select status from public.order_status_history where order_id=$1',[f.id])).rows.length)
    }
  })
})
test('real owner isolation, cancellation/failure retain made-to-order stock',async()=> {
  await rollbackTest(async(client,{checkout,payment})=> {
    const f=await fixture(client)
    assert.equal(await checkout.findOwnedOrder({kind:'guest',hash:'0'.repeat(64)},{id:f.id}),null)
    assert.equal(await checkout.cancelOwnedOrder({kind:'guest',hash:'0'.repeat(64)},f.id),false)
    assert.equal(await checkout.cancelOwnedOrder({kind:'guest',hash:f.hash},f.id),true)
    assert.equal((await client.query('select gateway_order_status from public.orders where id=$1',[f.id])).rows[0].gateway_order_status,'checkout_dismissed')
    assert.equal(await payment.failRdsPayment({orderId:f.id,razorpayOrderId:f.gatewayId,paymentId:f.paymentId}),true)
    assert.equal((await payment.finalizeRdsOrder(input(f))).result.ok,true)
    assert.equal(await payment.failRdsPayment({orderId:f.id,razorpayOrderId:f.gatewayId}),false)
    assert.equal((await client.query('select stock_quantity from public.products where id=$1',[f.product.id])).rows[0].stock_quantity,f.product.stock_quantity)
  })
})
test('new discovery leaves legacy stock orders outside its made-to-order scope',async()=> {
  await rollbackTest(async(client,{reconciliation})=> {
    const f=await fixture(client,{legacy:true})
    const before=(await client.query('select stock_quantity from public.products where id=$1',[f.product.id])).rows[0].stock_quantity
    assert.equal((await reconciliation.claimRdsPendingOrders()).some((o)=>o.id===f.id),false)
    assert.equal((await client.query('select stock_quantity from public.products where id=$1',[f.product.id])).rows[0].stock_quantity,before)
  })
})
test('real gift/coupon finalization increments usage once and rolls back',async()=> {
  await rollbackTest(async(client,{payment})=> {
    const coupon=(await client.query(`select id,code,gift_product_id,usage_count from public.coupons
      where is_active and reward_type='free_gift' and gift_product_id is not null order by id limit 1`)).rows[0]
    assert.ok(coupon,'isolated clone must contain the audited free-gift coupon')
    const giftBefore=(await client.query('select stock_quantity from public.products where id=$1',[coupon.gift_product_id])).rows[0].stock_quantity
    const f=await fixture(client,{payload:{checkout:{coupon:{id:coupon.id,code:coupon.code,discountAmount:0}}},
      gift:{product_id:coupon.gift_product_id,coupon_id:coupon.id}})
    assert.equal((await payment.finalizeRdsOrder(input(f))).result.ok,true)
    assert.equal((await payment.finalizeRdsOrder(input(f))).result.already_paid,true)
    assert.equal(Number((await client.query('select usage_count from public.coupons where id=$1',[coupon.id])).rows[0].usage_count),Number(coupon.usage_count||0)+1)
    assert.equal((await client.query('select stock_quantity from public.products where id=$1',[coupon.gift_product_id])).rows[0].stock_quantity,giftBefore)
  })
})
test('real discovery expiry is stock-free, lease-bound, and permits late capture',async()=> {
  await rollbackTest(async(client,{reconciliation,payment})=> {
    const f=await fixture(client)
    await client.query("update public.orders set created_at=now()-interval '20 minutes' where id=$1",[f.id])
    const orders=await reconciliation.claimRdsPendingOrders(); const claimed=orders.find((o)=>o.id===f.id)
    assert.ok(claimed); assert.equal(claimed.deadline_passed,true)
    assert.equal(await reconciliation.finishRdsPendingOrder({...claimed,lease_token:'wrong'},{status:'expired',expire:true}),false)
    assert.equal(await reconciliation.finishRdsPendingOrder(claimed,{status:'expired',expire:true}),true)
    assert.equal((await client.query('select gateway_order_status from public.orders where id=$1',[f.id])).rows[0].gateway_order_status,'expired')
    assert.equal((await payment.finalizeRdsOrder(input(f))).result.ok,true)
    assert.equal((await client.query('select gateway_order_status from public.orders where id=$1',[f.id])).rows[0].gateway_order_status,'paid')
    assert.equal((await client.query('select stock_quantity from public.products where id=$1',[f.product.id])).rows[0].stock_quantity,f.product.stock_quantity)
  })
})
test('real missing-ledger capture discovery finalizes through application code',async()=> {
  await rollbackTest(async(client,{reconciliation})=> {
    const f=await fixture(client,{payload:{totals:{totalUsd:112,exchangeRate:1}}})
    await client.query("update public.orders set created_at=now()-interval '20 minutes',gateway_order_status='expired' where id=$1",[f.id])
    assert.equal((await client.query('select count(*)::int n from public.payment_recovery_actions where order_id=$1',[f.id])).rows[0].n,0)
    const claimed=(await reconciliation.claimRdsPendingOrders()).find((o)=>o.id===f.id); assert.ok(claimed)
    assert.equal(await services(client,f).reconcileRdsPendingOrder(claimed),'paid')
    const paid=(await client.query('select payment_status,gateway_payload from public.orders where id=$1',[f.id])).rows[0]
    assert.equal(paid.payment_status,'paid'); assert.equal(paid.gateway_payload.totals.totalUsd,112)
    assert.equal(paid.gateway_payload.f8Reconciliation.lastResult,'paid')
    assert.equal(paid.gateway_payload.f8Reconciliation.leaseToken,null)
  })
})
test('real provider-confirmed absence expires made-to-order order without stock changes',async()=> {
  await rollbackTest(async(client,{reconciliation})=> {
    const f=await fixture(client)
    await client.query("update public.orders set created_at=now()-interval '20 minutes' where id=$1",[f.id])
    const claimed=(await reconciliation.claimRdsPendingOrders()).find((o)=>o.id===f.id); assert.ok(claimed)
    assert.equal(await services(client,f,{payments:[]}).reconcileRdsPendingOrder(claimed),'expired')
    assert.equal((await client.query('select gateway_order_status from public.orders where id=$1',[f.id])).rows[0].gateway_order_status,'expired')
    assert.equal((await client.query('select stock_quantity from public.products where id=$1',[f.product.id])).rows[0].stock_quantity,f.product.stock_quantity)
  })
})
test('real complete cron run is repeatable with mocked provider and real SQL',async()=> {
  await rollbackTest(async(client)=> {
    const f=await fixture(client)
    const worker=services(client,f)
    const first=await worker.runRdsReconciliation()
    assert.equal(first.ok,true); assert.ok(first.finalized>=1)
    const second=await worker.runRdsReconciliation()
    assert.equal(second.ok,true); assert.equal(second.finalized,0)
    assert.equal((await client.query('select payment_status from public.orders where id=$1',[f.id])).rows[0].payment_status,'paid')
  })
})
test('real durable captured-payment queue retries finalization without any refund',async()=> {
  await rollbackTest(async(client,{reconciliation})=> {
    const f=await fixture(client)
    const f7=load('lib/f7-payment.ts', {'@/lib/email':{},'@/lib/repositories/payment-repository':modules(client).payment})
    const queued=await f7.recoverF7CapturedPayment({orderId:f.id,paymentId:f.paymentId,amountInSubunits:f.amount,
      currency:f.currency,reasonCode:'finalization_rpc_error'})
    assert.equal(queued.durable,true); assert.equal(queued.status,'processing')
    const claimed=(await reconciliation.claimDueRdsRecovery()).find((a)=>a.order_id===f.id); assert.ok(claimed)
    assert.equal(await services(client,f).reconcileRdsRecovery(claimed),'manual_review')
    assert.equal((await client.query('select payment_status from public.orders where id=$1',[f.id])).rows[0].payment_status,'paid')
    const ledger=(await client.query('select provider_refund_id,last_error from public.payment_recovery_actions where id=$1',[claimed.id])).rows[0]
    assert.equal(ledger.provider_refund_id,null); assert.match(ledger.last_error,/Payment finalized; no refund issued/)
  })
})
test('real recovery claims, microsecond leases, refund terminality and retry exhaustion',async()=> {
  await rollbackTest(async(client,{payment,reconciliation})=> {
    const f=await fixture(client)
    const claim=await payment.claimRdsRecovery({orderId:f.id,paymentId:f.paymentId,amountInSubunits:f.amount,currency:f.currency,reasonCode:'finalization_rpc_error'})
    assert.equal(claim.should_attempt,true)
    await assert.rejects(payment.claimRdsRecovery({orderId:f.id,paymentId:f.paymentId,amountInSubunits:f.amount+1,
      currency:f.currency,reasonCode:'finalization_rpc_error'}),/Recovery order mismatch/)
    const different=await fixture(client)
    await assert.rejects(payment.claimRdsRecovery({orderId:different.id,paymentId:f.paymentId,amountInSubunits:different.amount,
      currency:different.currency,reasonCode:'finalization_rpc_error'}),/Conflicting recovery action/)
    assert.equal((await payment.claimRdsRecovery({orderId:f.id,paymentId:f.paymentId,amountInSubunits:f.amount,currency:f.currency,reasonCode:'finalization_rpc_error'})).should_attempt,false)
    await client.query("update public.payment_recovery_actions set next_attempt_at='1970-01-01', leased_until=null where id=$1",[claim.action_id])
    const claimed=(await reconciliation.claimDueRdsRecovery()).find((a)=>a.id===claim.action_id)
    assert.ok(claimed); assert.equal(typeof claimed.leased_until,'string')
    assert.equal(await reconciliation.finishRdsRecovery({...claimed,attempt_count:claimed.attempt_count-1},{status:'failed',lastError:null,nextAttemptAt:new Date().toISOString()}),false)
    const refundId=`refund_f8_synthetic_${randomUUID()}`
    assert.equal(await reconciliation.finishRdsRecovery(claimed,{status:'refunded',refundId,lastError:null,nextAttemptAt:new Date().toISOString()}),true)
    await payment.recordRdsRefundEvent({refundId,paymentId:f.paymentId,status:'failed'})
    assert.equal((await client.query('select status from public.payment_recovery_actions where id=$1',[claim.action_id])).rows[0].status,'refunded')
    assert.equal((await payment.finalizeRdsOrder(input(f))).result.error_code,'payment_recovery_refund_exists')
    await client.query("update public.payment_recovery_actions set status='failed', attempt_count=8, next_attempt_at=now(), leased_until=null where id=$1",[claim.action_id])
    assert.equal((await reconciliation.claimDueRdsRecovery()).some((a)=>a.id===claim.action_id),false)
    assert.ok(await reconciliation.escalateRdsExhaustedRecovery())
    assert.equal((await client.query('select status from public.payment_recovery_actions where id=$1',[claim.action_id])).rows[0].status,'manual_review')
    assert.ok(await reconciliation.countRdsRecoveryAttention())
  })
})
test('real webhook lease reclaim rejects stale completion',async()=> {
  await rollbackTest(async(client,{payment})=> {
    const eventId=`event_f8_synthetic_${randomUUID()}`
    const event={eventId,eventType:'synthetic',orderId:null,paymentId:null,payload:{synthetic:run}}
    const first=await payment.claimRdsWebhook(event); assert.ok(first)
    assert.equal(await payment.claimRdsWebhook(event),null)
    await client.query("update public.payment_webhook_events set processing_started_at=now()-interval '6 minutes' where provider='razorpay' and event_id=$1",[eventId])
    // now() is transaction-stable. Introduce a distinct microsecond generation
    // before the old completion check, matching independently claimed sessions.
    const current=(await client.query("update public.payment_webhook_events set processing_started_at=clock_timestamp() where provider='razorpay' and event_id=$1 returning processing_started_at::text token",[eventId])).rows[0].token
    await assert.rejects(payment.completeRdsWebhook(eventId,first))
    await payment.completeRdsWebhook(eventId,current)
  })
})
test('real concurrent finalizers serialize, finalize once, and block delayed failure',async()=> {
  const f=await committedFixture(); const a=await connect(); const b=await connect(); const observer=await connect()
  try {
    await begin(a); await begin(b)
    await a.query('select id from public.orders where id=$1 for update',[f.id])
    const pidA=(await a.query('select pg_backend_pid() pid')).rows[0].pid
    const pidB=(await b.query('select pg_backend_pid() pid')).rows[0].pid
    const competing=modules(b).payment.finalizeRdsOrder(input(f))
    await blocked(observer,pidB,pidA)
    assert.equal(await modules(a).checkout.cancelOwnedOrder({kind:'guest',hash:f.hash},f.id),true)
    // Exercise the real expiry completion while the competing finalizer is
    // blocked on this same fixture. No pre-existing order is modified.
    const expiryToken=randomUUID()
    await a.query(`update public.orders set created_at=now()-interval '20 minutes',
      gateway_payload=gateway_payload||jsonb_build_object('f8Reconciliation',jsonb_build_object(
        'leaseToken',$2::text,'leaseUntilEpoch',extract(epoch from now()+interval '5 minutes')))
      where id=$1 and notes=$3`,[f.id,expiryToken,run])
    assert.equal(await modules(a).reconciliation.finishRdsPendingOrder({id:f.id,lease_token:expiryToken},
      {status:'expired',expire:true}),true)
    const first=await modules(a).payment.finalizeRdsOrder(input(f)); assert.equal(first.result.already_paid,false)
    await a.query('COMMIT')
    const second=await competing; assert.equal(second.result.already_paid,true); await b.query('COMMIT')
    await begin(a); assert.equal(await modules(a).payment.failRdsPayment({orderId:f.id,razorpayOrderId:f.gatewayId}),false); await a.query('ROLLBACK')
    assert.equal((await observer.query('select stock_quantity from public.products where id=$1',[f.product.id])).rows[0].stock_quantity,f.product.stock_quantity)
  } finally { await a.query('ROLLBACK'); await b.query('ROLLBACK'); await Promise.all([a.end(),b.end(),observer.end()]) }
})
test('real recovery queues safely while a concurrent finalization commits',async()=> {
  const f=await committedFixture(); const a=await connect(); const b=await connect(); const observer=await connect()
  try {
    await begin(a); await begin(b)
    await a.query('select id from public.orders where id=$1 for update',[f.id])
    const pidA=(await a.query('select pg_backend_pid() pid')).rows[0].pid
    const pidB=(await b.query('select pg_backend_pid() pid')).rows[0].pid
    const f7=load('lib/f7-payment.ts',{'@/lib/email':{},'@/lib/repositories/payment-repository':modules(b).payment})
    const recovering=f7.recoverF7CapturedPayment({orderId:f.id,paymentId:f.paymentId,amountInSubunits:f.amount,
      currency:f.currency,reasonCode:'finalization_rpc_error'})
    await blocked(observer,pidB,pidA)
    assert.equal((await modules(a).payment.finalizeRdsOrder(input(f))).result.ok,true); await a.query('COMMIT')
    assert.equal((await recovering).durable,true); await b.query('COMMIT')
    await begin(b)
    const claim=(await modules(b).reconciliation.claimDueRdsRecovery()).find((r)=>r.order_id===f.id); assert.ok(claim)
    // This may also lease existing due rows in b. Roll back that transaction,
    // then update ONLY our newly created ledger row for retained test evidence.
    assert.equal(await services(b,f).reconcileRdsRecovery(claim),'manual_review')
    const ledger=(await b.query('select provider_refund_id from public.payment_recovery_actions where id=$1',[claim.id])).rows[0]
    assert.equal(ledger.provider_refund_id,null); await b.query('ROLLBACK')
    await begin(b)
    await b.query("update public.payment_recovery_actions set status='manual_review',leased_until=null,last_error='Synthetic paid-order recovery race verified; no refund issued' where order_id=$1 and payment_id=$2",[f.id,f.paymentId])
    await b.query('COMMIT')
  } finally { await a.query('ROLLBACK'); await b.query('ROLLBACK'); await Promise.all([a.end(),b.end(),observer.end()]) }
})
test('real overlapping discovery workers skip locked synthetic order',async()=> {
  const f=await committedFixture(); const a=await connect(); const b=await connect()
  try {
    await begin(a); await begin(b)
    // Keep any pre-existing rows locked out of both test workers without
    // modifying them; all uncommitted claims roll back at the end.
    await a.query('select id from public.orders where id=$1 for update',[f.id])
    const second=await modules(b).reconciliation.claimRdsPendingOrders()
    assert.equal(second.some((o)=>o.id===f.id),false)
    await b.query('ROLLBACK')
    const first=(await modules(a).reconciliation.claimRdsPendingOrders()).find((o)=>o.id===f.id)
    assert.ok(first)
    await a.query('ROLLBACK')
    await begin(a)
    await a.query("update public.orders set gateway_payload=gateway_payload||'{\"f8Reconciliation\":{\"reviewRequired\":true,\"lastResult\":\"synthetic concurrency fixture retained\"}}'::jsonb where id=$1 and notes=$2",[f.id,run])
    await a.query('COMMIT')
  } finally { await a.query('ROLLBACK'); await b.query('ROLLBACK'); await Promise.all([a.end(),b.end()]) }
})
test('real overlapping recovery claims lease a payment once',async()=> {
  const f=await committedFixture(); const a=await connect(); const b=await connect()
  try {
    await begin(a)
    const claim=await modules(a).payment.claimRdsRecovery({orderId:f.id,paymentId:f.paymentId,amountInSubunits:f.amount,currency:f.currency,reasonCode:'f8_synthetic_concurrency'})
    await a.query("update public.payment_recovery_actions set next_attempt_at='1970-01-01',leased_until=null where id=$1",[claim.action_id])
    await a.query('COMMIT')
    await begin(a); await begin(b)
    const first=(await a.query('select id from public.claim_due_payment_recovery_actions($1)',[1])).rows
    assert.equal(first[0]?.id,claim.action_id)
    const second=(await b.query('select id from public.claim_due_payment_recovery_actions($1)',[1])).rows
    assert.equal(second.some((r)=>r.id===claim.action_id),false)
    await b.query('ROLLBACK')
    await a.query("update public.payment_recovery_actions set status='manual_review',leased_until=null,last_error='Synthetic concurrency fixture retained' where id=$1",[claim.action_id])
    await a.query("update public.orders set gateway_payload=gateway_payload||'{\"f8Reconciliation\":{\"reviewRequired\":true,\"lastResult\":\"synthetic concurrency fixture retained\"}}'::jsonb where id=$1 and notes=$2",[f.id,run])
    await a.query('COMMIT')
  } finally { await a.query('ROLLBACK'); await b.query('ROLLBACK'); await Promise.all([a.end(),b.end()]) }
})
test('real concurrent webhook claims and later reclaim fence old handler completion',async()=> {
  const a=await connect(); const b=await connect(); const observer=await connect()
  const eventId=`event_f8_synthetic_${randomUUID()}`
  const event={eventId,eventType:'synthetic',orderId:null,paymentId:null,payload:{synthetic:run}}
  try {
    await begin(a); await begin(b)
    const first=await modules(a).payment.claimRdsWebhook(event); assert.ok(first)
    const pidA=(await a.query('select pg_backend_pid() pid')).rows[0].pid
    const pidB=(await b.query('select pg_backend_pid() pid')).rows[0].pid
    const competing=modules(b).payment.claimRdsWebhook(event)
    await blocked(observer,pidB,pidA)
    await a.query('COMMIT'); retainedEvents.push(eventId)
    assert.equal(await competing,null); await b.query('ROLLBACK')
    await begin(a)
    await a.query("update public.payment_webhook_events set processing_started_at=now()-interval '6 minutes' where event_id=$1 and provider='razorpay'",[eventId])
    await a.query('COMMIT')
    await begin(b); const newer=await modules(b).payment.claimRdsWebhook(event); assert.ok(newer); assert.notEqual(newer,first)
    await b.query('COMMIT')
    await begin(a); await assert.rejects(modules(a).payment.completeRdsWebhook(eventId,first)); await a.query('ROLLBACK')
    await begin(b); await modules(b).payment.completeRdsWebhook(eventId,newer); await b.query('COMMIT')
  } finally { await a.query('ROLLBACK'); await b.query('ROLLBACK'); await Promise.all([a.end(),b.end(),observer.end()]) }
})
test.after(async()=> {
  const proof=[]; const client=await connect()
  try {
    await client.query('BEGIN READ ONLY')
    for(const table of protectedTables) {
      const original=baseline.get(table)
      const digest=(await client.query(`select md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by t.id::text),'')) digest,
        count(*)::int count from public.${table} t where t.id::text = any($1::text[])`,[original.ids])).rows[0]
      proof.push({table,existingRows:original.ids.length,unchanged:digest.count===original.ids.length&&digest.digest===original.digest})
    }
    await client.query('ROLLBACK')
  } finally { await client.end() }
  writeFileSync('.codex-temp/f8-sql-existing-data-proof.json',JSON.stringify(proof,null,2))
  writeFileSync('.codex-temp/f8-sql-fixtures.json',JSON.stringify({ database:'hod_f7_test',role:'hod_app',run,
    retainedOrderIds:retained,retainedWebhookEventIds:retainedEvents },null,2))
  assert.ok(proof.every((item)=>item.unchanged),'All pre-existing application-visible business rows must remain identical')
  console.log(`Isolated clone only: ${retained.length} new tagged synthetic concurrency orders retained; rollback-only fixtures removed automatically. No existing data deleted.`)
})
