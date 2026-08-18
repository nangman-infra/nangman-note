import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { IBM_Plex_Mono, Inter, Manrope } from 'next/font/google';
import { AuthSessionProvider } from '@/components/auth/AuthSessionProvider';
import { FeedbackProvider } from '@/components/feedback/FeedbackProvider';
import { NetworkStatusBanner } from '@/components/feedback/NetworkStatusBanner';
import { env, getServerRuntimeVar } from '@/lib/config/env';
import { THEME_INIT_SCRIPT } from '@/lib/theme/theme';
import { getSiteUrl } from '@/lib/seo/site-url';
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

const inter = Inter({
  variable: '--font-body',
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

const siteUrl = getSiteUrl();
const siteUrlString = siteUrl.toString();
const appTitle = 'TransNote | AI Meeting Notes Workspace';
const appDescription = '실시간 전사와 노트 중심 워크플로우를 결합한 회의 기록 워크스페이스';

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: appTitle,
    template: '%s | TransNote',
  },
  applicationName: 'TransNote',
  description: appDescription,
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: 'TransNote',
    url: siteUrlString,
    title: appTitle,
    description: appDescription,
    images: [
      {
        url: '/opengraph-image?v=3',
        width: 1200,
        height: 630,
        alt: 'TransNote AI Meeting Notes Workspace',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: appTitle,
    description: appDescription,
    images: ['/twitter-image?v=3'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TransNote',
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#08131f',
  colorScheme: 'dark light',
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
        {/* 저장된 테마를 하이드레이션 전에 적용 (다크 모드 FOUC 방지) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${manrope.variable} ${inter.variable} ${plexMono.variable} antialiased`}>
        <NetworkStatusBanner />
        <AuthSessionProvider>
          <FeedbackProvider>{children}</FeedbackProvider>
        </AuthSessionProvider>
        {env.ANALYTICS_SCRIPT_URL && (
          <Script
            src={env.ANALYTICS_SCRIPT_URL}
            data-site-id={env.ANALYTICS_SITE_ID}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
