'use client'

import { useEffect, useState } from 'react'

type Status = 'checking' | 'rds' | 'unavailable'

export default function DataSourceStatus() {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    const controller = new AbortController()
    async function check() {
      try {
        const response = await fetch('/api/public/data-source-status', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const result: { source?: string; checked?: boolean } = await response.json()
        setStatus(response.ok && result.source === 'rds' && result.checked === true ? 'rds' : 'unavailable')
      } catch {
        if (!controller.signal.aborted) setStatus('unavailable')
      }
    }
    void check()
    return () => controller.abort()
  }, [])

  const verified = status === 'rds'
  return (
    <div
      role="status"
      aria-live="polite"
      title="Checks a fresh read of the storefront's global settings row. This does not verify every page query."
      className="fixed bottom-4 left-4 z-[900] max-w-[calc(100vw-2rem)] rounded-full border border-black/10 bg-white/95 px-3 py-2 text-[11px] font-medium text-[#17243a] shadow-md backdrop-blur-sm"
    >
      <span className={`mr-2 inline-block size-2 rounded-full ${verified ? 'bg-green-600' : status === 'checking' ? 'bg-amber-500' : 'bg-red-600'}`} />
      {verified ? 'RDS settings read verified' : status === 'checking' ? 'Checking data source…' : 'RDS settings read unavailable'}
    </div>
  )
}
