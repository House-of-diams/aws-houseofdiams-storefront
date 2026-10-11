import type { Metadata } from 'next';
import AuthShell from '@/components/auth/AuthShell';
import CustomerAuthEntry from '@/components/auth/CustomerAuthEntry';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create your House of Diams account.',
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return (
    <AuthShell
      eyebrow="House of Diams Membership"
      title="Create your private account"
      description="Begin your House of Diams profile with an elevated sign-up flow designed to feel as considered as the collection itself."
      asideTitle="A quieter, more personal way to shop"
      asideBody="Sign up once and continue with a longer-running session, future private features, and a smoother path through bespoke and ready-to-ship pieces."
      asidePoints={['Username Saved', 'Secure Password Auth', 'Session Persistence']}
    >
      {process.env.HOD_CUSTOMER_AUTH_ENABLED === 'true' ? <CustomerAuthEntry mode="signup" /> : <p>Customer accounts are temporarily unavailable. Please return later.</p>}
    </AuthShell>
  );
}
