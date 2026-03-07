import type { Metadata } from 'next';
import { FeaturesContent } from './FeaturesContent';

export const metadata: Metadata = {
  title: '사용 가이드',
  description:
    '회의 시작부터 결과 확인까지, 7단계로 TransNote의 모든 기능을 안내합니다.',
  alternates: { canonical: '/landing/features' },
  openGraph: {
    title: '사용 가이드 — TransNote',
    description: '7단계 유저 플로우로 배우는 AI 회의록 워크스페이스',
    url: '/landing/features',
  },
};

export default function FeaturesPage() {
  return <FeaturesContent />;
}
