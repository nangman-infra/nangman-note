import { beforeEach, describe, expect, it } from 'vitest';
import { useTranscriptionStore } from './transcriptionStore';

describe('useTranscriptionStore', () => {
  beforeEach(() => {
    useTranscriptionStore.setState({
      segments: [],
      partial: null,
      isConnected: false,
      isTranscriptExpanded: false,
      hasActiveSession: false,
      error: null,
    });
  });

  it('stores final segment immediately with pending translation state', () => {
    useTranscriptionStore.getState().handlePayload({
      type: 'final',
      resultId: 'result-1',
      text: '안녕하세요',
      startTime: 0,
      endTime: 1.2,
      translationPending: true,
    });

    const state = useTranscriptionStore.getState();
    expect(state.segments).toHaveLength(1);
    expect(state.segments[0]).toMatchObject({
      resultId: 'result-1',
      text: '안녕하세요',
      translationStatus: 'pending',
    });
  });

  it('applies translation update to existing segment', () => {
    useTranscriptionStore.getState().handlePayload({
      type: 'final',
      resultId: 'result-1',
      text: '안녕하세요',
      startTime: 0,
      endTime: 1.2,
      translationPending: true,
    });

    useTranscriptionStore.getState().handlePayload({
      type: 'translation',
      resultId: 'result-1',
      translatedText: 'hello',
    });

    const state = useTranscriptionStore.getState();
    expect(state.segments[0]).toMatchObject({
      resultId: 'result-1',
      translatedText: 'hello',
      translationStatus: 'done',
    });
  });

  it('squashes excessive repeats in realtime text payload', () => {
    useTranscriptionStore.getState().handlePayload({
      type: 'final',
      resultId: 'result-1',
      text: 'OK OK OK OK 좋아요좋아요좋아요',
      startTime: 0,
      endTime: 1,
    });

    const state = useTranscriptionStore.getState();
    expect(state.segments).toHaveLength(1);
    expect(state.segments[0]?.text).toBe('OK OK 좋아요좋아요');
  });

  it('preserves provider result identity so post-resync translations still apply', () => {
    useTranscriptionStore.getState().syncSegmentsFromServer([
      {
        id: 'db-segment-1',
        providerResultId: 'provider-result-1',
        text: '안녕하세요',
        startTime: 0,
        endTime: 1.2,
      },
    ]);

    useTranscriptionStore.getState().handlePayload({
      type: 'translation',
      resultId: 'provider-result-1',
      translatedText: 'hello',
    });

    expect(useTranscriptionStore.getState().segments).toEqual([
      expect.objectContaining({
        resultId: 'provider-result-1',
        translatedText: 'hello',
        translationStatus: 'done',
      }),
    ]);
  });

  it('deduplicates legacy server rows against matching live segments', () => {
    useTranscriptionStore.getState().handlePayload({
      type: 'final',
      resultId: 'live-result-1',
      text: '  같은   문장 ',
      startTime: 10,
      endTime: 11.2,
      translationPending: true,
    });

    useTranscriptionStore.getState().syncSegmentsFromServer([
      {
        id: 'legacy-db-segment',
        text: '같은 문장',
        startTime: 10.1,
        endTime: 11.3,
      },
    ]);

    expect(useTranscriptionStore.getState().segments).toEqual([
      expect.objectContaining({
        resultId: 'live-result-1',
        text: '같은 문장',
        translationStatus: 'pending',
      }),
    ]);
  });
});
