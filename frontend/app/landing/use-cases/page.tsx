import type { Metadata } from 'next';
import { UseCasesContent } from './UseCasesContent';

export const metadata: Metadata = {
  title: '실제 사례',
  description:
    '2시간 회의 자동 분리, 문서 타입 비교, 모델 품질 비교 — 실제 결과물로 확인하세요.',
  alternates: { canonical: '/landing/use-cases' },
  openGraph: {
    title: '실제 사례 — TransNote',
    description: '실제 결과물로 확인하는 AI 회의록 품질',
    url: '/landing/use-cases',
  },
};

export default function UseCasesPage() {
  return <UseCasesContent />;
}
