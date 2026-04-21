import { MeetingCompletionState } from '../types/meeting-completion-state.enum';
import { MeetingProcessingPhase } from '../types/meeting-processing-phase.enum';
import type { Meeting } from '../types/meeting.types';

const statusConfig = {
  recording: {
    label: '진행 중',
    colorClass: 'text-indigo-600',
  },
  processing: {
    label: '정리 중',
    colorClass: 'text-amber-600',
  },
  completed: {
    label: '완료',
    colorClass: 'text-slate-500',
  },
} as const;

const processingPhaseConfig = {
  [MeetingProcessingPhase.UPLOADING]: {
    label: '업로드 중',
    colorClass: 'text-sky-600',
  },
  [MeetingProcessingPhase.TRANSCRIBING]: {
    label: '전사 중',
    colorClass: 'text-amber-600',
  },
  [MeetingProcessingPhase.GENERATING]: {
    label: '정리 중',
    colorClass: 'text-amber-600',
  },
  [MeetingProcessingPhase.REGENERATING]: {
    label: '재생성 중',
    colorClass: 'text-indigo-600',
  },
} as const;

const completionStateConfig = {
  [MeetingCompletionState.SUCCEEDED]: {
    label: '완료',
    colorClass: 'text-slate-500',
  },
  [MeetingCompletionState.PARTIAL]: {
    label: '부분 완료',
    colorClass: 'text-orange-600',
  },
  [MeetingCompletionState.ATTENTION_REQUIRED]: {
    label: '확인 필요',
    colorClass: 'text-rose-600',
  },
  [MeetingCompletionState.FAILED]: {
    label: '실패',
    colorClass: 'text-rose-600',
  },
} as const;

type MeetingCardStatusConfig = {
  label: string;
  colorClass: string;
};

export function getMeetingStatusConfig(meeting: Meeting): MeetingCardStatusConfig {
  const phaseConfig = getPhaseStatusConfig(meeting);
  const completionConfig = getCompletionStatusConfig(meeting);

  if (meeting.status === 'processing' && meeting.needsAttention) {
    return {
      label: '확인 필요',
      colorClass: 'text-rose-600',
    };
  }

  if (meeting.status === 'processing' && phaseConfig) {
    return phaseConfig;
  }

  if (meeting.status === 'completed' && meeting.needsAttention) {
    return completionStateConfig[MeetingCompletionState.ATTENTION_REQUIRED];
  }

  if (meeting.status === 'completed' && completionConfig) {
    return completionConfig;
  }

  return statusConfig[meeting.status];
}

export function getCardSelectionClassName({
  isSelected,
  isActive,
}: {
  isSelected: boolean;
  isActive?: boolean;
}): string {
  if (isSelected) return 'bg-indigo-50 shadow-md ring-2 ring-brand/30';
  if (isActive) return 'bg-white shadow-md ring-1 ring-brand/10';
  return 'hover:bg-white hover:shadow-sm';
}

export function getProcessingBannerClassName(needsAttention?: boolean): string {
  if (needsAttention) return 'bg-rose-50 text-rose-700';
  return 'bg-amber-50 text-amber-700';
}

export function getProcessingBannerMessage(meeting: Meeting): string {
  if (meeting.needsAttention) {
    return '확인이 필요한 처리 이슈가 있습니다.';
  }

  if (meeting.processingPhase === MeetingProcessingPhase.UPLOADING) {
    return '오디오 업로드 중...';
  }

  if (meeting.processingPhase === MeetingProcessingPhase.TRANSCRIBING) {
    return '전사 처리 중...';
  }

  return '회의록 생성 중...';
}

function getPhaseStatusConfig(meeting: Meeting): MeetingCardStatusConfig | null {
  if (!meeting.processingPhase) return null;
  if (!(meeting.processingPhase in processingPhaseConfig)) return null;

  return processingPhaseConfig[
    meeting.processingPhase as keyof typeof processingPhaseConfig
  ];
}

function getCompletionStatusConfig(meeting: Meeting): MeetingCardStatusConfig | null {
  if (meeting.status !== 'completed') return null;
  if (!meeting.completionState) return null;
  if (!(meeting.completionState in completionStateConfig)) return null;

  return completionStateConfig[
    meeting.completionState as keyof typeof completionStateConfig
  ];
}
