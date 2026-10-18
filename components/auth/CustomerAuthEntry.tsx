'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function CustomerAuthEntry({ mode }: { mode: 'login' | 'signup' }) {
  const params = useSearchParams()
  const next = params.get('next') || '/profile'
  const start = (flow: string) => `/api/customer-auth/start?${new URLSearchParams({ flow, next })}`
  return <div className="grid gap-4 text-sm">
    <p>{mode === 'signup' ? 'Create your account securely with House of Diams.' : 'Sign in to your House of Diams account.'}</p>
    {params.has('error') ? <p role="alert">We could not complete sign in. Please try again.</p> : null}
    <a className="brand-button text-center" href={start(mode)}>{mode === 'signup' ? 'Create account with email' : 'Continue with email'}</a>
    <a className="border border-gray-300 p-3 text-center" href={start('google')}>Continue with Google</a>
    <p>Your password is entered on our secure account service.</p>
    <Link className="underline" href={`${mode === 'signup' ? '/login' : '/signup'}?${new URLSearchParams({ next })}`} prefetch={false}>{mode === 'signup' ? 'Already have an account? Sign in' : 'Create an account'}</Link>
  </div>
}
