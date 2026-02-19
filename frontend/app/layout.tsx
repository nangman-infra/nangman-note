import type { Metadata } from 'next';
import { IBM_Plex_Mono, Manrope } from 'next/font/google';
import { FeedbackProvider } from '@/components/feedback/FeedbackProvider';
import '@toast-ui/editor/dist/toastui-editor.css';
import './globals.css';

const manrope = Manrope({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-code',
  subsets: ['latin'],
  weight: ['400', '500'],
  preload: false,
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TransNote | AI Meeting Notes Workspace',
  description: '실시간 전사와 노트 중심 워크플로우를 결합한 회의 기록 워크스페이스',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${manrope.variable} ${plexMono.variable} antialiased`}>
        <FeedbackProvider>{children}</FeedbackProvider>
      </body>
    </html>
  );
}
