import { beforeEach, describe, expect, it, vi } from 'vitest';
import { meetingApi } from '../api/meetingApi';
import { MeetingStatus, MeetingTranscriptionMode, type Meeting } from '../types/meeting.types';
import { useMeetingStore } from './meetingStore';

vi.mock('../api/meetingApi', () => ({
  meetingApi: {
    create: vi.fn(),
    list: vi.fn(),
    listTrash: vi.fn(),
    search: vi.fn(),
    get: vi.fn(),
    updatePrompt: vi.fn(),
    complete: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
    purge: vi.fn(),
  },
}));

function buildMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 'meeting-1',
    promptId: 'prompt_default_meeting',
    status: MeetingStatus.RECORDING,
    transcriptionMode: MeetingTranscriptionMode.BATCH,
    startedAt: '2026-03-01T00:00:00.000Z',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('useMeetingStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMeetingStore.setState({
      currentMeeting: null,
      isRecording: false,
      elapsedTime: 0,
      meetings: [],
      trashMeetings: [],
      isLoading: false,
      error: null,
    });
  });

  it('startMeeting stores created meeting and sets recording state', async () => {
    const created = buildMeeting();
    vi.mocked(meetingApi.create).mockResolvedValue(created);

    const result = await useMeetingStore.getState().startMeeting({
      title: '테스트 회의',
      transcriptionMode: MeetingTranscriptionMode.BATCH,
    });

    expect(result).toEqual(created);
    expect(meetingApi.create).toHaveBeenCalledWith({
      title: '테스트 회의',
      transcriptionMode: MeetingTranscriptionMode.BATCH,
    });
    expect(useMeetingStore.getState().currentMeeting).toEqual(created);
    expect(useMeetingStore.getState().isRecording).toBe(true);
  });

  it('endMeeting forwards options to API and updates state', async () => {
    const current = buildMeeting();
    const completed = buildMeeting({
      status: MeetingStatus.COMPLETED,
      endedAt: '2026-03-01T01:00:00.000Z',
    });
    useMeetingStore.setState({
      currentMeeting: current,
      isRecording: true,
      isLoading: false,
      error: null,
    });
    vi.mocked(meetingApi.complete).mockResolvedValue(completed);

    const success = await useMeetingStore
      .getState()
      .endMeeting({ skipTranscription: true });

    expect(success).toBe(true);
    expect(meetingApi.complete).toHaveBeenCalledWith(current.id, {
      skipTranscription: true,
    });
    expect(useMeetingStore.getState().currentMeeting).toEqual(completed);
    expect(useMeetingStore.getState().isRecording).toBe(false);
  });

  it('returns false when ending meeting without current meeting', async () => {
    const success = await useMeetingStore.getState().endMeeting();

    expect(success).toBe(false);
    expect(meetingApi.complete).not.toHaveBeenCalled();
  });

  it('returns null and sets error when startMeeting fails', async () => {
    vi.mocked(meetingApi.create).mockRejectedValue(new Error('start failed'));

    const result = await useMeetingStore.getState().startMeeting({
      title: '실패 회의',
      transcriptionMode: MeetingTranscriptionMode.BATCH,
    });

    expect(result).toBeNull();
    expect(useMeetingStore.getState().error).toBe('start failed');
    expect(useMeetingStore.getState().isLoading).toBe(false);
  });

  it('updates prompt on current meeting', async () => {
    const current = buildMeeting({
      id: 'meeting-2',
      promptId: 'prompt_default_meeting',
    });
    const updated = buildMeeting({
      id: 'meeting-2',
      promptId: 'prompt_user_custom',
    });
    useMeetingStore.setState({ currentMeeting: current });
    vi.mocked(meetingApi.updatePrompt).mockResolvedValue(updated);

    const result = await useMeetingStore
      .getState()
      .updatePrompt('prompt_user_custom');

    expect(result).toEqual(updated);
    expect(meetingApi.updatePrompt).toHaveBeenCalledWith(
      'meeting-2',
      'prompt_user_custom',
    );
    expect(useMeetingStore.getState().currentMeeting?.promptId).toBe(
      'prompt_user_custom',
    );
  });

  it('loads meeting list from API', async () => {
    const meetings = [buildMeeting({ id: 'meeting-1' }), buildMeeting({ id: 'meeting-2' })];
    vi.mocked(meetingApi.list).mockResolvedValue(meetings);

    await useMeetingStore.getState().fetchMeetings();

    expect(useMeetingStore.getState().meetings).toEqual(meetings);
    expect(useMeetingStore.getState().error).toBeNull();
  });

  it('maps search results into meeting list', async () => {
    vi.mocked(meetingApi.search).mockResolvedValue([
      {
        meetingId: 'meeting-search-1',
        title: '',
        status: MeetingStatus.PROCESSING,
        transcriptionMode: MeetingTranscriptionMode.BATCH,
        matchedIn: 'note',
        snippet: '검색 스니펫',
        startedAt: '2026-03-01T00:00:00.000Z',
      },
    ]);

    await useMeetingStore.getState().searchMeetings('검색어', 'all');

    expect(meetingApi.search).toHaveBeenCalledWith('검색어', 'all');
    expect(useMeetingStore.getState().meetings).toEqual([
      expect.objectContaining({
        id: 'meeting-search-1',
        title: '검색 스니펫',
        status: MeetingStatus.PROCESSING,
        transcriptionMode: MeetingTranscriptionMode.BATCH,
      }),
    ]);
  });

  it('removes deleted meeting from state list', async () => {
    useMeetingStore.setState({
      meetings: [buildMeeting({ id: 'meeting-1' }), buildMeeting({ id: 'meeting-2' })],
    });
    vi.mocked(meetingApi.delete).mockResolvedValue(undefined);

    await useMeetingStore.getState().deleteMeeting('meeting-1');

    expect(meetingApi.delete).toHaveBeenCalledWith('meeting-1');
    expect(useMeetingStore.getState().meetings).toEqual([
      expect.objectContaining({ id: 'meeting-2' }),
    ]);
  });

  it('loads trash meetings list from API', async () => {
    const trashed = [buildMeeting({ id: 'meeting-trash-1' })];
    vi.mocked(meetingApi.listTrash).mockResolvedValue(trashed);

    await useMeetingStore.getState().fetchTrashMeetings();

    expect(useMeetingStore.getState().trashMeetings).toEqual(trashed);
  });

  it('restores meeting by removing it from trash state', async () => {
    useMeetingStore.setState({
      trashMeetings: [buildMeeting({ id: 'meeting-trash-1' })],
    });
    vi.mocked(meetingApi.restore).mockResolvedValue(undefined);

    const restored = await useMeetingStore
      .getState()
      .restoreMeeting('meeting-trash-1');

    expect(restored).toBe(true);
    expect(meetingApi.restore).toHaveBeenCalledWith('meeting-trash-1');
    expect(useMeetingStore.getState().trashMeetings).toHaveLength(0);
  });
});
