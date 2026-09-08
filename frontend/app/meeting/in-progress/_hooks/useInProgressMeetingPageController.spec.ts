// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { useInProgressMeetingPageController } from './useInProgressMeetingPageController';

const mocks = vi.hoisted(() => ({
  currentMeeting: null as Record<string, unknown> | null,
  captureStream: null as MediaStream | null,
  capturePermission: 'granted',
  audioStreamingState: 'idle',
  recorderState: 'idle',
  requestPermission: vi.fn(),
  startStreaming: vi.fn(),
  stopStreaming: vi.fn(),
  startRecording: vi.fn(),
  meetingGet: vi.fn(),
  setCurrentMeeting: vi.fn(),
  socketRef: {
    current: { connected: true } as unknown as Socket,
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/components/feedback/FeedbackProvider', () => ({
  useFeedback: () => ({ pushToast: vi.fn() }),
}));

vi.mock('@/domains/meeting', () => ({
  MeetingStatus: { RECORDING: 'recording' },
  MeetingTranscriptionMode: { REALTIME: 'realtime', BATCH: 'batch' },
  meetingApi: {
    get: mocks.meetingGet,
    updateTranscriptionMode: vi.fn(),
  },
  useBeforeUnloadGuard: vi.fn(),
  useHistoryBackGuard: vi.fn(),
  useMeeting: () => ({
    currentMeeting: mocks.currentMeeting,
    isLoading: false,
    error: null,
    endMeeting: vi.fn(),
    setCurrentMeeting: mocks.setCurrentMeeting,
  }),
}));

vi.mock('@/domains/note', () => {
  const useNoteStore = (
    selector: (state: { isDirty: boolean; noteContent: string }) => unknown,
  ) => selector({ isDirty: false, noteContent: '' });
  useNoteStore.getState = () => ({ isDirty: false, noteContent: '' });
  return { useNoteStore };
});

vi.mock('@/domains/transcription', () => ({
  useAudioCapture: () => ({
    permission: mocks.capturePermission,
    error: null,
    devices: [],
    selectedDeviceId: '',
    stream: mocks.captureStream,
    requestPermission: mocks.requestPermission,
    selectDevice: vi.fn(),
    stopCapture: vi.fn(),
  }),
  useMediaRecorder: () => ({
    state: mocks.recorderState,
    chunkCount: 0,
    error: null,
    startRecording: mocks.startRecording,
    stopRecording: vi.fn(),
    assembleSessions: vi.fn(),
    cleanupChunks: vi.fn(),
  }),
  useAudioUpload: () => ({
    uploadState: 'idle',
    progress: 0,
    error: null,
    upload: vi.fn(),
    reset: vi.fn(),
  }),
  useAudioStreaming: () => ({
    state: mocks.audioStreamingState,
    error: null,
    startStreaming: mocks.startStreaming,
    stopStreaming: mocks.stopStreaming,
  }),
  useTranscription: () => ({
    segments: [],
    partial: null,
    isConnected: true,
    hasActiveSession: true,
    error: null,
    stopSession: vi.fn(),
    socketRef: mocks.socketRef,
  }),
  useWakeLock: vi.fn(),
}));

vi.mock('../_components/meetingStatusView', () => ({
  buildInProgressBanners: () => [],
  getConnectionBadge: () => ({ label: '', tone: 'neutral' }),
  getRecordingBadge: () => ({ label: '', tone: 'neutral' }),
}));

vi.mock('./useInProgressEndMeetingFlow', () => ({
  useInProgressEndMeetingFlow: () => ({
    showEndDialog: false,
    setShowEndDialog: vi.fn(),
    isEnding: false,
    isUploadingAudio: false,
    uploadFailed: false,
    handleEndConfirm: vi.fn(),
    handleRetryUpload: vi.fn(),
    handleContinueWithoutAudio: vi.fn(),
  }),
}));

function stream(name: string) {
  return { name } as unknown as MediaStream;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  window.history.replaceState({}, '', '/meeting/in-progress');
  mocks.currentMeeting = {
    id: 'meeting-1',
    title: '회의',
    status: 'recording',
    transcriptionMode: 'realtime',
    startedAt: null,
  };
  mocks.captureStream = null;
  mocks.capturePermission = 'granted';
  mocks.audioStreamingState = 'idle';
  mocks.recorderState = 'idle';
  mocks.requestPermission.mockReset().mockResolvedValue({ granted: true });
  mocks.startStreaming.mockReset().mockResolvedValue(undefined);
  mocks.stopStreaming.mockReset();
  mocks.startRecording.mockReset();
  mocks.meetingGet.mockReset();
  mocks.setCurrentMeeting.mockReset();
});

describe('useInProgressMeetingPageController audio lifecycle', () => {
  it('stops a dead realtime pipeline and attaches the recovered stream once', () => {
    const firstStream = stream('first');
    const recoveredStream = stream('recovered');
    mocks.captureStream = firstStream;
    const { rerender } = renderHook(() =>
      useInProgressMeetingPageController(),
    );

    expect(mocks.startStreaming).toHaveBeenCalledTimes(1);
    expect(mocks.startStreaming).toHaveBeenLastCalledWith(
      firstStream,
      mocks.socketRef.current,
      expect.any(Object),
    );

    act(() => {
      mocks.audioStreamingState = 'streaming';
      mocks.captureStream = null;
      rerender();
    });
    expect(mocks.stopStreaming).toHaveBeenCalledOnce();

    act(() => {
      mocks.audioStreamingState = 'stopped';
      mocks.captureStream = recoveredStream;
      rerender();
    });
    rerender();

    expect(mocks.startStreaming).toHaveBeenCalledTimes(2);
    expect(mocks.startStreaming).toHaveBeenLastCalledWith(
      recoveredStream,
      mocks.socketRef.current,
      expect.any(Object),
    );
  });

  it('waits for persisted meeting mode before capture or recording starts', async () => {
    window.history.replaceState(
      {},
      '',
      '/meeting/in-progress?meetingId=meeting-reloading',
    );
    const recoveredMeeting = {
      id: 'meeting-reloading',
      title: '복구 회의',
      status: 'recording',
      transcriptionMode: 'realtime',
      startedAt: null,
    };
    const meetingRequest = deferred<typeof recoveredMeeting>();
    mocks.currentMeeting = null;
    mocks.capturePermission = 'prompt';
    mocks.captureStream = stream('available-before-mode');
    mocks.meetingGet.mockReturnValue(meetingRequest.promise);
    mocks.setCurrentMeeting.mockImplementation((meeting) => {
      mocks.currentMeeting = meeting;
    });

    renderHook(() => useInProgressMeetingPageController());

    expect(mocks.requestPermission).not.toHaveBeenCalled();
    expect(mocks.startRecording).not.toHaveBeenCalled();
    expect(mocks.startStreaming).not.toHaveBeenCalled();

    await act(async () => {
      meetingRequest.resolve(recoveredMeeting);
      await meetingRequest.promise;
      await Promise.resolve();
    });

    expect(mocks.requestPermission).toHaveBeenCalledOnce();
    expect(mocks.startRecording).not.toHaveBeenCalled();
    expect(mocks.startStreaming).toHaveBeenCalledOnce();
  });
});
