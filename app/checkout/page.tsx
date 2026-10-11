import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import CheckoutPageClient from '@/components/checkout/CheckoutPageClient';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Static checkout preview for House of Diams.',
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  // Preserve the release guard until customer/payment UAT is approved.
  // An OFF gate must not expose a checkout that can no longer place an order.
  if (process.env.HOD_CUSTOMER_AUTH_ENABLED === 'true' || process.env.HOD_F7_RDS_WRITE_PREPARED !== 'true') {
    return <section className="mx-auto max-w-2xl px-6 py-16"><h1 className="text-2xl">Checkout is temporarily unavailable</h1><p className="mt-4">Please return later to complete your purchase.</p></section>;
  }
  return (
    <div className={plusJakartaSans.className}>
      <CheckoutPageClient customerAuthEnabled={process.env.HOD_CUSTOMER_AUTH_ENABLED === 'true'} />
    </div>
  );
}
