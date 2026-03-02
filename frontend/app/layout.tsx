import type { Metadata } from 'next';
import { IBM_Plex_Mono, Manrope } from 'next/font/google';
import { AuthSessionProvider } from '@/components/auth/AuthSessionProvider';
import { FeedbackProvider } from '@/components/feedback/FeedbackProvider';
import { getServerRuntimeVar } from '@/lib/config/env';
import '@toast-ui/editor/dist/toastui-editor.css';
import './globals.css';

/**
 * 모든 페이지를 동적 렌더링으로 전환.
 * layout.tsx에서 process.env.WS_URL 을 런타임에 읽어야 하므로
 * 빌드 타임에 정적으로 고정되면 안 됩니다.
 */
export const dynamic = 'force-dynamic';

/**
 * 런타임 환경변수를 클라이언트에 주입하기 위한 스크립트.
 * NEXT_PUBLIC_* 와 달리 빌드 타임이 아닌 런타임에 읽힌다.
 * → 하나의 Docker 이미지를 여러 환경에서 재사용 가능.
 */
function buildRuntimeEnvScript(): string {
  const runtimeEnv = {
    WS_URL: getServerRuntimeVar('WS_URL'),
  };
  return `window.__RUNTIME_ENV__=${JSON.stringify(runtimeEnv)};`;
}

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
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: buildRuntimeEnvScript() }}
        />
      </head>
      <body className={`${manrope.variable} ${plexMono.variable} antialiased`}>
        <AuthSessionProvider>
          <FeedbackProvider>{children}</FeedbackProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
