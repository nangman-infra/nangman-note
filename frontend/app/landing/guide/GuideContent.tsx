'use client';

import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { BottomCta } from '@/components/landing/BottomCta';
import { MobileStickyCta } from '@/components/landing/MobileStickyCta';
import { ScrollProgress } from '@/components/landing/ScrollProgress';
import { ScrollReveal } from '@/components/landing/ScrollReveal';
import { FlowMockNewMeeting } from '@/components/landing/flow-mocks/FlowMockNewMeeting';
import { FlowMockInProgress } from '@/components/landing/flow-mocks/FlowMockInProgress';
import { FlowMockProcessing } from '@/components/landing/flow-mocks/FlowMockProcessing';
import { FlowMockResult } from '@/components/landing/flow-mocks/FlowMockResult';
import { FlowMockRegenerate } from '@/components/landing/flow-mocks/FlowMockRegenerate';
import { FlowMockManage } from '@/components/landing/flow-mocks/FlowMockManage';

const flowSteps = [
  {
    num: '01',
    title: '회의 만들기',
    description: '제목을 입력하고 문서 타입을 선택하세요. 안건을 미리 적어두면 AI가 주제를 더 정확하게 나눕니다.',
    tips: [
      '제목을 비워두면 AI가 내용을 보고 자동으로 지어줍니다',
      '고급 설정에서 전사 모드(실시간/배치), 언어, 번역을 바꿀 수 있습니다',
      '설정 페이지에서 기본값을 정해두면 매번 바꿀 필요 없습니다',
    ],
    mock: FlowMockNewMeeting,
  },
  {
    num: '02',
    title: '회의 진행',
    description: '왼쪽에서 노트를 적고, 오른쪽에서 전사가 실시간으로 쌓이는 걸 확인하세요.',
    tips: [
      '노트는 Markdown으로 작성되고 3초마다 자동 저장됩니다',
      '전사 패널은 접어둬도 됩니다 — 노트에 집중하세요',
      '실시간 모드에서는 화자가 자동으로 구분되고, 번역도 함께 표시됩니다',
      '마이크 권한을 거부하면 노트 전용 모드로 동작합니다',
    ],
    mock: FlowMockInProgress,
  },
  {
    num: '03',
    title: '회의 종료 & AI 처리',
    description: '종료 버튼을 누르면 오디오 업로드 → 전사 → AI 문서 생성이 자동으로 진행됩니다.',
    tips: [
      '배치 모드에서는 녹음 파일이 먼저 업로드됩니다 (보통 수 초)',
      '전사 변환은 회의 길이에 따라 2~5분 정도 걸립니다',
      '진행 상황은 실시간으로 표시되며, 완료되면 자동으로 메인 화면으로 이동합니다',
    ],
    mock: FlowMockProcessing,
  },
  {
    num: '04',
    title: '결과 확인',
    description: '회의록 · 전사 원본 · 메모를 3개 탭으로 전환하며 확인할 수 있습니다.',
    tips: [
      '회의록 탭: AI가 안건별로 나눈 구조화된 문서 (결정사항, 할 일 포함)',
      '전사 원본 탭: 타임스탬프 + 화자 구분이 포함된 전체 전사 텍스트',
      '메모 탭: 회의 중 작성한 노트 원본',
    ],
    mock: FlowMockResult,
  },
  {
    num: '05',
    title: '편집 & 내보내기',
    description: '생성된 문서를 바로 수정하고, PDF · DOCX · Markdown으로 내보낼 수 있습니다.',
    tips: [
      '편집 버튼을 누르면 WYSIWYG 에디터가 열립니다',
      '수정 후 저장하면 원본이 업데이트됩니다',
      '복사 버튼으로 클립보드에 바로 복사할 수도 있습니다',
    ],
    mock: null,
  },
  {
    num: '06',
    title: '다시 생성',
    description: '같은 전사 데이터로 다른 문서 타입을 적용해 완전히 다른 결과물을 만들 수 있습니다.',
    tips: [
      '회의록 → 강의노트로 바꾸면 개념 단위 정리로 변환됩니다',
      '커스텀 프롬프트를 만들어서 원하는 형태로 정리할 수도 있습니다',
      '재생성해도 이전 결과는 덮어쓰이므로, 필요하면 먼저 내보내기 하세요',
    ],
    mock: FlowMockRegenerate,
  },
  {
    num: '07',
    title: '관리',
    description: '시간 · 태그 · 상태 필터와 전문 검색으로 회의를 찾고, 휴지통과 일괄 작업으로 정리하세요.',
    tips: [
      '⌘K (Ctrl+K)로 빠르게 검색할 수 있습니다',
      '태그 필터: 회의록 · 강의 · 멘토링으로 빠르게 분류',
      '휴지통에서 복원하거나 영구 삭제할 수 있습니다',
      '선택 모드에서 여러 회의를 한번에 삭제/복원할 수 있습니다',
      '설정 페이지에서 기본 전사 설정과 커스텀 프롬프트를 관리합니다',
    ],
    mock: FlowMockManage,
  },
] as const;

export function GuideContent() {
  return (
    <div className="landing-shell min-h-dvh">
      <ScrollProgress />
      <LandingNav />
      <main className="pt-28">
        {/* 페이지 헤더 */}
        <div className="mx-auto max-w-6xl px-5">
          <ScrollReveal>
            <p className="text-center text-xs font-semibold tracking-widest text-muted">
              GUIDE
            </p>
            <h1 className="mt-2 text-center text-3xl font-bold sm:text-4xl">
              사용 가이드
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-center text-sm text-muted">
              회의 시작부터 결과 확인까지, 7단계로 TransNote의 모든 기능을 안내합니다.
            </p>
          </ScrollReveal>
        </div>

        {/* 플로우 단계들 */}
        <div className="mx-auto mt-16 max-w-5xl px-5">
          {flowSteps.map((step, i) => (
            <div key={step.num}>
              <ScrollReveal>
                <div className={`flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12 ${i % 2 !== 0 ? 'lg:flex-row-reverse' : ''}`}>
                  {/* 텍스트 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-brand/10 text-xs font-bold text-brand">
                        {step.num}
                      </span>
                      <h2 className="text-xl font-bold">{step.title}</h2>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted">
                      {step.description}
                    </p>

                    {/* 팁 리스트 */}
                    <ul className="mt-4 space-y-2">
                      {step.tips.map((tip) => (
                        <li key={tip} className="flex items-start gap-2 text-sm">
                          <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand/40" />
                          <span className="text-muted">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 목업 */}
                  <div className="min-w-0 flex-1">
                    {step.mock ? <step.mock /> : <EditExportMock />}
                  </div>
                </div>
              </ScrollReveal>

              {/* 연결 화살표 */}
              {i < flowSteps.length - 1 && (
                <div className="flex justify-center py-8" aria-hidden="true">
                  <div className="flex flex-col items-center gap-1">
                    <div className="h-8 w-px bg-[var(--line-soft)]" />
                    <div className="h-2 w-2 rotate-45 border-b border-r border-[var(--line-soft)]" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="landing-section-divider mt-16" />
        <BottomCta nextHref="/landing/how-it-works" nextLabel="동작 방식 보기" />
      </main>
      <LandingFooter />
      <MobileStickyCta />
    </div>
  );
}

/** 편집 & 내보내기 목업 (step 05 전용) */
function EditExportMock() {
  return (
    <div className="surface-card overflow-hidden text-[11px]">
      <div className="border-b border-[var(--line-soft)] bg-white/40 px-4 py-2.5">
        <span className="font-semibold">편집 모드</span>
      </div>
      <div className="p-4">
        {/* 툴바 */}
        <div className="mb-3 flex flex-wrap gap-1 rounded-lg border border-[var(--line-soft)] bg-white/60 px-2 py-1.5">
          {['H', 'B', 'I', 'S', '—', '❝', '•', '1.', '☑', '⊞', '🔗', '</>'].map((btn) => (
            <span key={btn} className="rounded px-1.5 py-0.5 text-[10px] text-muted hover:bg-white/80">
              {btn}
            </span>
          ))}
        </div>

        {/* 에디터 콘텐츠 */}
        <div className="space-y-1.5 text-[10px]">
          <p className="font-bold">## 배포 일정 확인</p>
          <p>3/15 스테이징, 3/18 프로덕션 배포 확정</p>
          <p className="rounded bg-brand/5 px-2 py-1 text-brand">← 여기를 직접 수정할 수 있습니다</p>
        </div>

        {/* 내보내기 버튼들 */}
        <div className="mt-4 flex gap-2">
          <span className="rounded-lg bg-brand/10 px-3 py-1.5 text-[10px] font-semibold text-brand">PDF 내보내기</span>
          <span className="rounded-lg bg-brand/10 px-3 py-1.5 text-[10px] font-semibold text-brand">DOCX 내보내기</span>
          <span className="rounded-lg bg-white/60 px-3 py-1.5 text-[10px] font-medium text-muted">Markdown 복사</span>
        </div>
      </div>
    </div>
  );
}
