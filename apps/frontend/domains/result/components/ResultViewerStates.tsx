export function ResultViewerLoadingState() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="surface-card w-full max-w-xl p-8 text-center">
        <p className="text-sm font-semibold">회의록을 불러오는 중입니다</p>
        <p className="mt-1 text-xs text-muted">AI 정리 결과를 준비하고 있어요.</p>
      </div>
    </div>
  );
}

export function ResultViewerEmptyState({
  isPending,
  isMissingMeeting,
}: {
  isPending: boolean;
  isMissingMeeting: boolean;
}) {
  const copy = getResultEmptyStateCopy({ isPending, isMissingMeeting });

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="surface-card w-full max-w-xl p-8 text-center">
        <p className="text-sm font-semibold">{copy.title}</p>
        <p className="mt-1 text-xs text-muted">{copy.description}</p>
      </div>
    </div>
  );
}

function getResultEmptyStateCopy({
  isPending,
  isMissingMeeting,
}: {
  isPending: boolean;
  isMissingMeeting: boolean;
}): { title: string; description: string } {
  if (isPending) {
    return {
      title: '전사 및 회의록을 생성하고 있습니다',
      description: '음성 전사와 AI 정리가 진행 중입니다. 완료 시 자동으로 표시됩니다.',
    };
  }

  if (isMissingMeeting) {
    return {
      title: '선택한 회의를 찾을 수 없습니다',
      description: '목록에서 다른 회의를 선택해주세요.',
    };
  }

  return {
    title: '선택한 회의의 결과가 아직 없습니다',
    description: '회의 종료 후 자동 생성된 문서가 여기에 표시됩니다.',
  };
}
