import type { AudioCapturePermission } from '@/domains/transcription';

export interface MeetingStatusBadge {
  label: string;
  className: string;
}

export interface InProgressBannerItem {
  variant: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  onDismiss?: () => void;
}

export function getConnectionBadge({
  meetingId,
  permission,
  wasFallenBack,
  isRealtimeMode,
  isConnected,
  hasActiveSession,
}: {
  meetingId: string;
  permission: AudioCapturePermission;
  wasFallenBack: boolean;
  isRealtimeMode: boolean;
  isConnected: boolean;
  hasActiveSession: boolean;
}): MeetingStatusBadge {
  if (!meetingId) return { label: '대기', className: 'bg-slate-100 text-slate-700' };
  if (permission === 'denied') return { label: '노트 전용', className: 'bg-amber-100 text-amber-800' };
  if (wasFallenBack) return { label: '배치로 전환됨', className: 'bg-amber-100 text-amber-800' };
  if (!isRealtimeMode) return { label: '배치 전사 모드', className: 'bg-slate-100 text-slate-700' };
  if (isConnected && hasActiveSession) return { label: '실시간 전사 중', className: 'bg-emerald-100 text-emerald-800' };
  if (isConnected) return { label: '실시간 연결됨', className: 'bg-blue-100 text-blue-800' };
  return { label: '실시간 연결중', className: 'bg-amber-100 text-amber-800' };
}

export function getRecordingBadge(
  permission: AudioCapturePermission,
  recorderState: string,
  chunkCount: number,
): MeetingStatusBadge {
  if (permission === 'denied' || permission === 'unsupported') {
    return { label: '녹음 비활성', className: 'bg-slate-100 text-slate-600' };
  }
  if (recorderState === 'recording') {
    return { label: `녹음 중 (${chunkCount}청크)`, className: 'bg-rose-100 text-rose-800' };
  }
  return { label: '녹음 대기', className: 'bg-slate-100 text-slate-600' };
}

export function buildInProgressBanners({
  meetingError,
  permission,
  recorderError,
  micBannerDismissed,
  audioCaptureError,
  isRealtimeMode,
  transcriptionError,
  audioStreamingError,
  onDismissMicBanner,
}: {
  meetingError: string | null;
  permission: AudioCapturePermission;
  recorderError: string | null;
  micBannerDismissed: boolean;
  audioCaptureError: string | null;
  isRealtimeMode: boolean;
  transcriptionError: string | null;
  audioStreamingError: string | null;
  onDismissMicBanner: () => void;
}): InProgressBannerItem[] {
  const banners: InProgressBannerItem[] = [];

  if (meetingError) {
    banners.push({ variant: 'error', title: '회의 상태 오류', message: meetingError });
  }
  if (permission === 'unsupported') {
    banners.push({
      variant: 'error',
      title: '마이크 미지원 브라우저',
      message: '현재 브라우저는 마이크 캡처를 지원하지 않습니다. Chrome 또는 Edge를 사용해주세요.',
    });
  }
  if (recorderError) {
    banners.push({ variant: 'warning', title: '녹음 오류', message: recorderError });
  }
  if (permission === 'denied' && !micBannerDismissed) {
    banners.push({
      variant: 'warning',
      title: '마이크 접근이 차단되었습니다',
      message: '노트 전용 모드로 진행 중입니다. 전사 데이터 없이 노트 기반으로만 결과를 생성합니다. 브라우저 설정에서 마이크 권한을 허용하면 녹음이 가능합니다.',
      onDismiss: onDismissMicBanner,
    });
  }
  if (audioCaptureError && permission !== 'denied' && permission !== 'unsupported') {
    banners.push({ variant: 'warning', title: '마이크 연결 오류', message: audioCaptureError });
  }
  if (isRealtimeMode && transcriptionError) {
    banners.push({
      variant: 'warning',
      title: '전사 연결 불안정',
      message: '전사 서버와의 연결이 지연되고 있습니다. 노트는 계속 저장됩니다.',
    });
  }
  if (isRealtimeMode && audioStreamingError) {
    banners.push({ variant: 'warning', title: '오디오 스트리밍 중단', message: audioStreamingError });
  }

  const priorityOrder = { error: 0, warning: 1, info: 2 } as const;
  return banners.sort((a, b) => priorityOrder[a.variant] - priorityOrder[b.variant]);
}
