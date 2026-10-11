import type { Metadata } from 'next'
import CheckoutSuccessClient from '@/components/checkout/CheckoutSuccessClient'

export const metadata: Metadata = {
  title: 'Order Status | House of Diams',
  description: 'View your House of Diams order confirmation and details.',
  robots: { index: false, follow: false },
}

export default function CheckoutSuccessPage() {
  return <CheckoutSuccessClient customerAuthEnabled={process.env.HOD_CUSTOMER_AUTH_ENABLED === 'true'} />
}
