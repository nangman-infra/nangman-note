import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'TransNote 로그인 페이지',
  alternates: {
    canonical: '/auth/signin',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
