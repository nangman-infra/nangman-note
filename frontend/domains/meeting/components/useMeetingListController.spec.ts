import { describe, expect, it } from 'vitest';
import { filterMeetingsByPrompt } from './useMeetingListController';

describe('filterMeetingsByPrompt', () => {
  const meetings = [
    { id: 'meeting-1', promptId: 'prompt-a' },
    { id: 'meeting-2', promptId: 'prompt-b' },
  ];

  it('filters regular meeting lists by the selected prompt', () => {
    expect(filterMeetingsByPrompt(meetings, 'prompt-b', false)).toEqual([
      meetings[1],
    ]);
  });

  it('does not filter server search results by synthetic prompt IDs', () => {
    expect(filterMeetingsByPrompt(meetings, 'prompt-b', true)).toBe(meetings);
  });
});
