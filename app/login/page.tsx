import type { Metadata } from 'next';
import AuthShell from '@/components/auth/AuthShell';
import CustomerAuthEntry from '@/components/auth/CustomerAuthEntry';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to your House of Diams account.',
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; error?: string | string[] }> }) {
  await connection();
  const params = await searchParams;
  if (process.env.HOD_CUSTOMER_AUTH_ENABLED === 'true' && !params.error) {
    const next = typeof params.next === 'string' ? params.next : '/profile';
    redirect(`/api/customer-auth/start?${new URLSearchParams({ flow: 'login', next })}`);
  }
  return (
    <AuthShell
      eyebrow="House of Diams Access"
      title="Enter the private salon"
      description="A refined sign-in experience for clients returning to their curated House of Diams journey."
      asideTitle="Everything waiting for you"
      asideBody="Your account keeps the experience elegant and continuous across visits, enquiries, and future saved pieces."
      asidePoints={['Persistent Session', 'Private Access', 'Luxury Support']}
    >
      {process.env.HOD_CUSTOMER_AUTH_ENABLED === 'true' ? <CustomerAuthEntry mode="login" /> : <p>Customer accounts are temporarily unavailable. Please return later.</p>}
    </AuthShell>
  );
}
