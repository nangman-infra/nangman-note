import { Languages, Mic, MicOff } from 'lucide-react';

type TranscriptPanelEmptyStateVariant = 'batch' | 'empty' | 'mic-disabled';

interface TranscriptPanelEmptyStateProps {
  variant: TranscriptPanelEmptyStateVariant;
}

const EMPTY_STATE_COPY: Record<
  TranscriptPanelEmptyStateVariant,
  { icon: typeof Mic; title: string; description: string; iconClassName?: string }
> = {
  'mic-disabled': {
    icon: MicOff,
    title: '마이크 접근이 차단되어 전사가 비활성화되었습니다.',
    description: '노트 작성에 집중해주세요.',
    iconClassName: 'text-slate-500',
  },
  batch: {
    icon: Mic,
    title: '현재 배치 전사 모드입니다.',
    description: '회의 종료 후 수집된 오디오가 AWS 배치 전사로 처리됩니다.',
    iconClassName: 'text-slate-500',
  },
  empty: {
    icon: Languages,
    title: '음성을 기다리고 있습니다...',
    description: '말씀하시면 실시간으로 텍스트가 표시됩니다.',
    iconClassName: 'text-slate-500',
  },
};

export function TranscriptPanelEmptyState({
  variant,
}: TranscriptPanelEmptyStateProps) {
  const copy = EMPTY_STATE_COPY[variant];
  const Icon = copy.icon;

  return (
    <div className="flex h-full items-center justify-center px-5 text-center text-sm text-slate-400">
      <div>
        <Icon className={`mx-auto mb-2 h-8 w-8 ${copy.iconClassName ?? ''}`} />
        <p>{copy.title}</p>
        <p className="mt-1 text-xs">{copy.description}</p>
      </div>
    </div>
  );
}
