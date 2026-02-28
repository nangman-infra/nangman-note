import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resultApi } from '../api/resultApi';
import { useResultStore } from './resultStore';

vi.mock('../api/resultApi', () => ({
  resultApi: {
    get: vi.fn(),
    update: vi.fn(),
    regenerate: vi.fn(),
    exportPDF: vi.fn(),
  },
}));

describe('useResultStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useResultStore.setState({
      result: null,
      isLoading: false,
      isRegenerating: false,
      isPending: false,
      isMissingMeeting: false,
      error: null,
    });
  });

  it('marks pending state when result is not ready yet', async () => {
    vi.mocked(resultApi.get).mockRejectedValue(
      new Error('Result for meeting m1 is not ready yet (status: processing)'),
    );

    await useResultStore.getState().fetchResult('m1');

    expect(useResultStore.getState().isPending).toBe(true);
    expect(useResultStore.getState().isMissingMeeting).toBe(false);
    expect(useResultStore.getState().error).toBeNull();
  });

  it('marks missing meeting state when meeting does not exist', async () => {
    vi.mocked(resultApi.get).mockRejectedValue(
      new Error('Meeting m1 not found'),
    );

    await useResultStore.getState().fetchResult('m1');

    expect(useResultStore.getState().isPending).toBe(false);
    expect(useResultStore.getState().isMissingMeeting).toBe(true);
    expect(useResultStore.getState().error).toBeNull();
  });

  it('keeps unknown errors as actionable error messages', async () => {
    vi.mocked(resultApi.get).mockRejectedValue(new Error('network failed'));

    await useResultStore.getState().fetchResult('m1');

    expect(useResultStore.getState().isPending).toBe(false);
    expect(useResultStore.getState().isMissingMeeting).toBe(false);
    expect(useResultStore.getState().error).toBe('network failed');
  });
});
