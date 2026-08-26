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
    <header className="z-40 sticky top-0 flex w-full flex-wrap items-center justify-between gap-2 bg-slate-50/80 px-3 py-2.5 shadow-sm shadow-[inset_0_-1px_0_0_rgba(197,197,215,0.2)] backdrop-blur-xl sm:flex-nowrap sm:px-6 sm:py-3">
      <div className="flex min-w-0 w-full items-center gap-3 sm:w-auto sm:gap-6">
        <span className="shrink-0 font-headline text-base font-extrabold tracking-tighter text-indigo-700 sm:text-xl">TransNote</span>
        <div className="hidden sm:block h-6 w-px bg-[var(--outline-variant)]/30" aria-hidden="true" />
        <nav
          aria-label="현재 회의 경로"
          className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium sm:gap-3"
        >
          <button
            type="button"
            onClick={onGoHome}
            className="hidden text-indigo-700 font-semibold font-headline tracking-tight hover:underline sm:inline"
          >
            대시보드
          </button>
          <span className="hidden text-slate-400 text-sm sm:inline" aria-hidden="true">›</span>
          <span
            className="min-w-0 truncate text-slate-900 font-bold font-headline tracking-tight sm:max-w-[32vw]"
            title={meetingTitle}
          >
            {meetingTitle}
          </span>
        </nav>
      </div>

      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-4">
        <div className="hidden sm:flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${recordingBadge.className}`}>
            {permission === 'denied' || permission === 'unsupported' ? (
              <MicOff className="mr-1 inline-block h-3.5 w-3.5" />
            ) : (
              <Mic className="mr-1 inline-block h-3.5 w-3.5" />
            )}
            {recordingBadge.label}
          </span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${connectionBadge.className}`}>
            <Radio className="mr-1 inline-block h-3.5 w-3.5" />
            {connectionBadge.label}
          </span>
          {micBannerDismissed && permission === 'denied' && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              <MicOff className="mr-1 inline-block h-3.5 w-3.5" />
              노트 전용
            </span>
          )}
          {devices.length > 1 && (
            <select
              value={selectedDeviceId || ''}
              onChange={(event) => onDeviceChange(event.target.value)}
              className="rounded-lg border border-[var(--line-soft)] bg-white px-2 py-1 text-xs"
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
          className="flex items-center rounded-full bg-[var(--surface-container-low)] px-2.5 py-1.5 sm:px-4"
          role="timer"
          aria-label={`경과 시간 ${formatTime(elapsedSeconds)}`}
        >
          <div className="relative mr-1.5 flex items-center justify-center sm:mr-3" aria-hidden="true">
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--tertiary-fixed-dim)]" />
            <div className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-[var(--tertiary-fixed-dim)] opacity-40" />
          </div>
          <span className="label-sm text-[var(--ink-subtle)] tracking-widest">{formatTime(elapsedSeconds)}</span>
        </div>

        <button
          type="button"
          onClick={onEndClick}
          disabled={isLoading || isEnding}
          aria-label="회의 종료"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-rose-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
        >
          <Square className="h-4 w-4" aria-hidden="true" />
          회의 종료
        </button>
      </div>
    </header>
  );
}
