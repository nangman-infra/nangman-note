// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetingTranscriptionMode } from '@/domains/meeting';
import { useInProgressEndMeetingFlow } from './useInProgressEndMeetingFlow';

const saveNote = vi.hoisted(() => vi.fn());
vi.mock('@/domains/note', () => ({ useNoteStore: { getState: () => ({ saveNote, error: '저장 충돌' }) } }));
vi.mock('@/domains/transcription', () => ({ transcriptionApi: { confirmUpload: vi.fn() } }));

function params() {
  return {
    meetingId: 'meeting-1', meetingStartedAt: null,
    transcriptionMode: MeetingTranscriptionMode.REALTIME, isRealtimeMode: true,
    recorderState: 'idle', error: null,
    endMeeting: vi.fn().mockResolvedValue(true), stopCapture: vi.fn(), stopStreaming: vi.fn(),
    stopTranscriptionSession: vi.fn().mockResolvedValue(undefined),
    stopRecording: vi.fn().mockResolvedValue([]), assembleSessions: vi.fn().mockResolvedValue([]),
    uploadAudio: vi.fn(), cleanupChunks: vi.fn().mockResolvedValue(undefined), pushToast: vi.fn(),
    setCurrentMeeting: vi.fn(), setMeetingIdFromQuery: vi.fn(), setShowProcessing: vi.fn(), navigateHome: vi.fn(),
  };
}

describe('meeting completion note barrier', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(cleanup);

  it('keeps recording and the meeting open if the latest note cannot be saved', async () => {
    saveNote.mockResolvedValue(false);
    const options = params();
    const { result } = renderHook(() => useInProgressEndMeetingFlow(options));
    await act(async () => result.current.handleEndConfirm());
    expect(options.stopStreaming).not.toHaveBeenCalled();
    expect(options.stopRecording).not.toHaveBeenCalled();
    expect(options.endMeeting).not.toHaveBeenCalled();
    expect(options.cleanupChunks).not.toHaveBeenCalled();
    expect(result.current.isEnding).toBe(false);
    expect(options.pushToast).toHaveBeenCalledWith(expect.objectContaining({ title: '노트를 저장한 뒤 회의를 종료해주세요' }));
  });

  it('awaits note save and deduplicates repeated completion clicks', async () => {
    let resolve!: (value: boolean) => void;
    saveNote.mockReturnValue(new Promise<boolean>((done) => { resolve = done; }));
    const options = params();
    const { result } = renderHook(() => useInProgressEndMeetingFlow(options));
    let completion!: Promise<void>;
    act(() => { completion = result.current.handleEndConfirm(); });
    await act(async () => result.current.handleEndConfirm());
    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(options.endMeeting).not.toHaveBeenCalled();
    await act(async () => { resolve(true); await completion; });
    expect(options.endMeeting).toHaveBeenCalledTimes(1);
    expect(options.stopStreaming).toHaveBeenCalledTimes(1);
    expect(options.navigateHome).toHaveBeenCalledTimes(1);
  });

  it('allows a retry after an unexpected save failure', async () => {
    saveNote.mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce(true);
    const options = params();
    const { result } = renderHook(() => useInProgressEndMeetingFlow(options));
    await act(async () => result.current.handleEndConfirm());
    expect(result.current.isEnding).toBe(false);
    await act(async () => result.current.handleEndConfirm());
    expect(options.endMeeting).toHaveBeenCalledTimes(1);
  });
});
