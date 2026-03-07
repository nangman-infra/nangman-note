import type { Metadata } from 'next';
import { LandingJsonLd } from '@/components/landing/JsonLd';
import './landing.css';

export const metadata: Metadata = {
  title: {
    default: 'TransNote — AI 회의록 워크스페이스',
    template: '%s — TransNote',
  },
  description:
    '실시간 전사, AI 구조화, 맞춤 문서 타입. 회의가 끝나면 회의록은 이미 완성되어 있습니다.',
  alternates: { canonical: '/landing' },
  openGraph: {
    title: 'TransNote — AI 회의록 워크스페이스',
    description:
      '실시간 전사와 노트 중심 워크플로우를 결합한 회의 기록 워크스페이스',
    url: '/landing',
  },
};

export default function LandingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <LandingJsonLd />
      {children}
    </>
  );
}
