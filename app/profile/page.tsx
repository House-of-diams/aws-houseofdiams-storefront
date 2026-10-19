import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import CustomerAccount from '@/components/auth/CustomerAccount';
import { isF7ReadPreviewEnabled } from '@/lib/f7-read-preview';
import { connection } from 'next/server';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  preload: false,
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Your House of Diams account profile.',
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  await connection();
  return (
    <div className={plusJakartaSans.className}>
      {process.env.HOD_CUSTOMER_AUTH_ENABLED === 'true' ? <CustomerAccount ordersEnabled={isF7ReadPreviewEnabled()} /> : <p>Customer accounts are temporarily unavailable. Please return later.</p>}
    </div>
  );
}
