'use client';

import { ArrowLeft } from 'lucide-react';

interface SettingsPageHeaderProps {
  onBack: () => void;
}

export function SettingsPageHeader({ onBack }: SettingsPageHeaderProps) {
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="btn-neo mb-5 inline-flex text-xs text-muted"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        워크스페이스로 돌아가기
      </button>

      <div className="mb-8">
        <p className="label-sm mb-2 text-[var(--ink-muted)]">
          Prompt Management
        </p>
        <h1 className="font-headline text-3xl font-extrabold tracking-tight sm:text-4xl">
          프롬프트 관리
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          팀에 맞는 회의록 템플릿을 선택·편집하고, 새 회의에 자동 적용할
          기본값을 관리합니다.
        </p>
      </div>
    </>
  );
}
