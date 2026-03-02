import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Meeting',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function MeetingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
