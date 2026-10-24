import Link from 'next/link'

type DataNoticeProps = {
  /** What we collect in this form, e.g. "name, email and message". */
  fields: string
  /** Why we collect it, completing "We use your ... to ...". */
  purpose: string
  className?: string
  /** `inherit` follows the surrounding text color, for dark sections. */
  tone?: 'default' | 'inherit'
}

// Shown next to every form that collects personal data, so the visitor knows what is collected and why before submitting.
export default function DataNotice({ fields, purpose, className = '', tone = 'default' }: DataNoticeProps) {
  return (
    <p className={`text-[11px] leading-[1.6] ${tone === 'inherit' ? 'opacity-70' : 'text-black/60'} ${className}`} data-testid="data-notice">
      We collect your {fields} to {purpose}. Our{' '}
      <Link href="/privacy-policy" className="underline underline-offset-2 hover:opacity-100" target="_blank" rel="noopener">Privacy Policy</Link>{' '}
      explains who receives it, how long we keep it and how to access or delete it. By submitting you also agree to our{' '}
      <Link href="/terms" className="underline underline-offset-2 hover:opacity-100" target="_blank" rel="noopener">Terms &amp; Conditions</Link>.
    </p>
  )
}
