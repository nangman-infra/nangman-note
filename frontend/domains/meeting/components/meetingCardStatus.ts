import { MeetingCompletionState } from '../types/meeting-completion-state.enum';
import { MeetingProcessingPhase } from '../types/meeting-processing-phase.enum';
import type { Meeting } from '../types/meeting.types';

const statusConfig = {
  recording: {
    label: '진행 중',
    colorClass: '!bg-[var(--tertiary-fixed)] !text-electric',
  },
  processing: {
    label: '정리 중',
    colorClass: '!bg-[var(--accent-soft)] !text-[var(--accent-text)]',
  },
  completed: {
    label: '완료',
    colorClass: '!bg-[var(--success-soft)] !text-[var(--success)]',
  },
} as const;

const processingPhaseConfig = {
  [MeetingProcessingPhase.UPLOADING]: {
    label: '업로드 중',
    colorClass: '!bg-[var(--info-soft)] !text-[var(--info)]',
  },
  [MeetingProcessingPhase.TRANSCRIBING]: {
    label: '전사 중',
    colorClass: '!bg-[var(--accent-soft)] !text-[var(--accent-text)]',
  },
  [MeetingProcessingPhase.GENERATING]: {
    label: '정리 중',
    colorClass: '!bg-[var(--accent-soft)] !text-[var(--accent-text)]',
  },
  [MeetingProcessingPhase.REGENERATING]: {
    label: '재생성 중',
    colorClass: '!bg-[var(--tertiary-fixed)] !text-electric',
  },
} as const;

const completionStateConfig = {
  [MeetingCompletionState.SUCCEEDED]: {
    label: '완료',
    colorClass: '!bg-[var(--success-soft)] !text-[var(--success)]',
  },
  [MeetingCompletionState.PARTIAL]: {
    label: '부분 완료',
    colorClass: '!bg-[var(--accent-soft)] !text-[var(--accent-text)]',
  },
  [MeetingCompletionState.ATTENTION_REQUIRED]: {
    label: '확인 필요',
    colorClass: '!bg-[var(--danger-soft)] !text-[var(--danger)]',
  },
  [MeetingCompletionState.FAILED]: {
    label: '실패',
    colorClass: '!bg-[var(--danger-soft)] !text-[var(--danger)]',
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
      colorClass: '!bg-[var(--danger-soft)] !text-[var(--danger)]',
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
  if (isSelected) return '!shadow-[inset_0_0_0_1px_var(--color-electric-current)] !bg-[var(--tertiary-fixed)]';
  if (isActive) return '!shadow-[inset_0_0_0_1px_rgba(7,122,199,0.6),0_0_12px_rgba(7,122,199,0.18)]';
  return 'hover:!bg-[var(--surface-container)]';
}

export function getProcessingBannerClassName(needsAttention?: boolean): string {
  if (needsAttention) return 'bg-[var(--danger-soft)] text-[var(--danger)]';
  return 'bg-[var(--accent-soft)] text-[var(--accent-text)]';
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
