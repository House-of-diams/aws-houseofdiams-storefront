import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import CheckoutPageClient from '@/components/checkout/CheckoutPageClient';
import { connection } from 'next/server';
import { isF7WritePrepared } from '@/lib/f7-write-prepared';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Static checkout preview for House of Diams.',
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  await connection();
  // Never expose checkout unless the same server-side gate used by the
  // placement, verification and webhook routes is enabled.
  if (!isF7WritePrepared()) {
    return <section className="mx-auto max-w-2xl px-6 py-16"><h1 className="text-2xl">Checkout is temporarily unavailable</h1><p className="mt-4">Please return later to complete your purchase.</p></section>;
  }
  return (
    <div className={plusJakartaSans.className}>
      <CheckoutPageClient customerAuthEnabled={process.env.HOD_CUSTOMER_AUTH_ENABLED === 'true'} />
    </div>
  );
}
