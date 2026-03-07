import type { Metadata } from 'next';
import { HowItWorksContent } from './HowItWorksContent';

export const metadata: Metadata = {
  title: '동작 방식',
  description:
    '회의 시작부터 AI 정리까지, 3단계로 완성되는 회의록 워크플로우를 확인하세요.',
  alternates: { canonical: '/landing/how-it-works' },
  openGraph: {
    title: '동작 방식 — TransNote',
    description: '3단계로 완성되는 AI 회의록 워크플로우',
    url: '/landing/how-it-works',
  },
};

export default function HowItWorksPage() {
  return <HowItWorksContent />;
}
