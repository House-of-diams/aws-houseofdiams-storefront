'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const fields = [
  ['first_name', 'First name'], ['last_name', 'Last name'], ['phone', 'Phone'],
  ['country', 'Country'], ['state', 'State'], ['district', 'District'], ['city', 'City'],
  ['postal_code', 'Postal code'], ['address_line_1', 'Address line 1'], ['address_line_2', 'Address line 2'],
] as const

export default function CustomerAccount({ ordersEnabled = false }: { ordersEnabled?: boolean }) {
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('Loading your account…')
  const [signedOut, setSignedOut] = useState(false)
  const [saving, setSaving] = useState(false)
  const [orders, setOrders] = useState<Array<{ id: string; order_number: string; status: string; payment_status: string }>>([])
  const [ordersPage, setOrdersPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [ordersStatus, setOrdersStatus] = useState('')
  useEffect(() => {
    if (!ordersEnabled || !email) return
    const controller = new AbortController()
    void fetch(`/api/profile/orders?page=${ordersPage}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Unable to load orders.')
        setOrders(body.orders); setTotalPages(body.pagination.totalPages); setOrdersStatus('')
      }).catch(() => { if (!controller.signal.aborted) setOrdersStatus('Unable to load orders.') })
    return () => controller.abort()
  }, [ordersEnabled, ordersPage, email])
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/customer-auth/profile', { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      if (response.status === 401) { setSignedOut(true); setStatus('Please sign in to view your account.'); return }
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      setEmail(body.identity.email); setProfile(body.profile); setStatus('')
    }).catch((error) => { if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : 'Unable to load your account.') })
    return () => controller.abort()
  }, [])

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setStatus('')
    try {
      const response = await fetch('/api/customer-auth/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(profile) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      setStatus('Your profile has been saved.')
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to save your profile.') }
    finally { setSaving(false) }
  }
  async function logout() {
    const response = await fetch('/api/customer-auth/logout', { method: 'POST' })
    const body = await response.json()
    if (!response.ok) { setStatus(body.error || 'Unable to sign out.'); return }
    window.location.assign(body.redirect)
  }
  return <section className="mx-auto max-w-3xl px-6 py-12">
    <h1 className="text-3xl">Your account</h1>
    <p role="status" className="my-4">{status}</p>
    {signedOut ? <Link className="underline" href="/login?next=%2Fprofile" prefetch={false}>Sign in</Link> : null}
    {email ? <>
      <p className="my-4">{email}</p>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        {fields.map(([key, label]) => <label key={key} className="grid gap-1 text-sm">{label}<input className="border border-gray-300 p-3" maxLength={200} value={profile[key] || ''} onChange={(event) => setProfile({ ...profile, [key]: event.target.value })} /></label>)}
        <button className="brand-button" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
      </form>
      <button className="mt-6 underline" onClick={() => void logout()}>Sign out</button>
      {ordersEnabled ? <div className="mt-8">
        <h2 className="text-xl">Your orders</h2>
        <p role="status" className="my-4 text-sm">{ordersStatus}</p>
        {orders.map((order) => <div key={order.id} className="border-b py-4">
          <Link className="underline" href={`/checkout/success?order=${encodeURIComponent(order.order_number)}`}>{order.order_number}</Link>
          <p className="text-sm">{order.status} · {order.payment_status}</p>
        </div>)}
        {!orders.length && !ordersStatus ? <p className="my-4 text-sm">You have no orders yet.</p> : null}
        <div className="mt-4 flex gap-4">
          <button disabled={ordersPage <= 1} onClick={() => setOrdersPage((page) => page - 1)}>Previous</button>
          <span>{ordersPage} / {totalPages}</span>
          <button disabled={ordersPage >= totalPages} onClick={() => setOrdersPage((page) => page + 1)}>Next</button>
        </div>
      </div> : <p className="mt-8 text-sm">Account order history will be available when account checkout opens.</p>}
    </> : null}
  </section>
}
