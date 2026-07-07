'use client';

import Link from 'next/link';

interface InProgressEmptyStateProps {
  isRecoveringMeeting: boolean;
}

export function InProgressEmptyState({
  isRecoveringMeeting,
}: InProgressEmptyStateProps) {
  if (isRecoveringMeeting) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-root)] p-6">
        <div className="w-full max-w-xl rounded-2xl bg-white p-8 text-center shadow-xl">
          <h1 className="font-headline text-2xl font-extrabold tracking-tight">회의 상태를 복구하는 중입니다</h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            잠시만 기다려주세요. 마지막으로 열었던 회의를 확인하고 있습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl bg-white p-7 text-center shadow-xl">
        <h1 className="text-2xl font-semibold">진행 중인 회의가 없습니다</h1>
        <p className="mt-2 text-sm text-muted">새 회의를 시작하면 이 화면에서 노트와 전사를 함께 관리할 수 있습니다.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/" className="btn-secondary inline-flex">
            홈으로 이동
          </Link>
          <Link href="/meeting/new" className="btn-primary inline-flex">
            새 회의 시작
          </Link>
        </div>
      </div>
    </div>
  );
}
