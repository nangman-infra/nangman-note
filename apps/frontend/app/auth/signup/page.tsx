import type { Metadata } from 'next';
import { AuthEntryPage } from '../signin/_components/AuthEntryPage';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'TransNote 회원가입 페이지',
  alternates: {
    canonical: '/auth/signup',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignUpPage() {
  return <AuthEntryPage mode="signup" />;
}
