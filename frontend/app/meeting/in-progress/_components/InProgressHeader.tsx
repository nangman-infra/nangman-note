'use client';

import { Mic, MicOff, Radio, Square } from 'lucide-react';
import type { AudioCapturePermission } from '@/domains/transcription';
import { formatTime } from '@/lib/utils/date';
import type { MeetingStatusBadge } from './meetingStatusView';

interface AudioDeviceOption {
  deviceId: string;
  label: string;
}

interface InProgressHeaderProps {
  meetingTitle: string;
  permission: AudioCapturePermission;
  devices: AudioDeviceOption[];
  selectedDeviceId: string;
  recordingBadge: MeetingStatusBadge;
  connectionBadge: MeetingStatusBadge;
  micBannerDismissed: boolean;
  elapsedSeconds: number;
  isLoading: boolean;
  isEnding: boolean;
  onGoHome: () => void;
  onDeviceChange: (deviceId: string) => void;
  onEndClick: () => void;
}

export function InProgressHeader({
  meetingTitle,
  permission,
  devices,
  selectedDeviceId,
  recordingBadge,
  connectionBadge,
  micBannerDismissed,
  elapsedSeconds,
  isLoading,
  isEnding,
  onGoHome,
  onDeviceChange,
  onEndClick,
}: InProgressHeaderProps) {
  return (
    <header className="z-40 sticky top-0 flex min-h-[62px] w-full flex-wrap items-center justify-between gap-2 border-b border-[var(--line-soft)] bg-white/90 px-3 py-2.5 backdrop-blur-xl sm:flex-nowrap sm:px-6 sm:py-0">
      <div className="flex min-w-0 w-full items-center gap-3 sm:w-auto sm:gap-5">
        <span className="font-headline shrink-0 text-base text-brand sm:text-[17px]">TransNote</span>
        <div className="hidden h-5 w-px bg-[var(--line-soft)] sm:block" aria-hidden="true" />
        <nav
          aria-label="현재 회의 경로"
          className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium sm:gap-3"
        >
          <button
            type="button"
            onClick={onGoHome}
            className="hidden text-sm font-normal text-[var(--ink-muted)] hover:text-brand sm:inline"
          >
            대시보드
          </button>
          <span className="hidden text-sm text-[var(--ink-faint)] sm:inline" aria-hidden="true">/</span>
          <span
            className="min-w-0 truncate text-sm font-medium text-[var(--ink-strong)] sm:max-w-[32vw]"
            title={meetingTitle}
          >
            {meetingTitle}
          </span>
        </nav>
      </div>

      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-4">
        <div className="hidden sm:flex items-center gap-2">
          <span className={`status-pill status-pill--idle ${recordingBadge.className}`}>
            {permission === 'denied' || permission === 'unsupported' ? (
              <MicOff className="mr-1 inline-block h-3.5 w-3.5" />
            ) : (
              <Mic className="mr-1 inline-block h-3.5 w-3.5" />
            )}
            {recordingBadge.label}
          </span>
          <span className={`status-pill status-pill--idle ${connectionBadge.className}`}>
            <Radio className="mr-1 inline-block h-3.5 w-3.5" />
            {connectionBadge.label}
          </span>
          {micBannerDismissed && permission === 'denied' && (
            <span className="status-pill status-pill--warn">
              <MicOff className="mr-1 inline-block h-3.5 w-3.5" />
              노트 전용
            </span>
          )}
          {devices.length > 1 && (
            <select
              value={selectedDeviceId || ''}
              onChange={(event) => onDeviceChange(event.target.value)}
              className="input-shell !w-auto !py-1 !px-2 text-xs"
              aria-label="마이크 선택"
            >
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          )}
        </div>
        <span className="sr-only" role="status" aria-live="polite">
          {recordingBadge.label}, {connectionBadge.label}
          {micBannerDismissed && permission === 'denied' ? ', 노트 전용' : ''}
        </span>

        <div
          className="flex h-9 items-center rounded-lg border border-[var(--line-soft)] bg-[var(--surface-container-low)] px-2.5 sm:px-3"
          role="timer"
          aria-label={`경과 시간 ${formatTime(elapsedSeconds)}`}
        >
          <div className="relative mr-2 flex items-center justify-center" aria-hidden="true">
            <div className="h-2 w-2 rounded-full bg-seafoam" />
            <div className="absolute h-2 w-2 animate-ping rounded-full bg-seafoam opacity-40" />
          </div>
          <span className="data-mono text-sm font-medium text-[var(--ink-strong)]">{formatTime(elapsedSeconds)}</span>
        </div>

        <button
          type="button"
          onClick={onEndClick}
          disabled={isLoading || isEnding}
          aria-label="회의 종료"
          className="btn-danger inline-flex min-h-9 !px-3 !py-2 disabled:cursor-not-allowed disabled:opacity-50 sm:!px-4"
        >
          <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          회의 종료
        </button>
      </div>
    </header>
  );
}
