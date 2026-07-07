import type { Metadata } from 'next';
import { StartContent } from './StartContent';

export const metadata: Metadata = {
  title: '시작하기',
  description:
    'TransNote를 시작하세요. 로그인 후 바로 AI 회의록 워크스페이스를 사용할 수 있습니다.',
  alternates: { canonical: '/landing/start' },
  openGraph: {
    title: '시작하기 — TransNote',
    description: '지금 바로 AI 회의록 워크스페이스를 시작하세요',
    url: '/landing/start',
  },
};

export default function StartPage() {
  return <StartContent />;
}
