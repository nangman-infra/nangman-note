import { describe, expect, it } from 'vitest';
import {
  areAllVisibleMeetingsSelected,
  pruneSelectionToVisible,
} from './meetingSelection';

describe('meetingSelection', () => {
  describe('pruneSelectionToVisible', () => {
    it('keeps only selected ids that are currently visible', () => {
      const selected = new Set(['m1', 'm2', 'm3']);

      const pruned = pruneSelectionToVisible(selected, ['m2', 'm4']);

      expect([...pruned]).toEqual(['m2']);
    });

    it('returns original set when nothing needs pruning', () => {
      const selected = new Set(['m1', 'm2']);

      const pruned = pruneSelectionToVisible(selected, ['m1', 'm2', 'm3']);

      expect(pruned).toBe(selected);
    });
  });

  describe('areAllVisibleMeetingsSelected', () => {
    it('returns true only when all visible ids are selected', () => {
      const selected = new Set(['m1', 'm2', 'm3']);

      expect(areAllVisibleMeetingsSelected(selected, ['m1', 'm2'])).toBe(true);
      expect(areAllVisibleMeetingsSelected(selected, ['m1', 'm4'])).toBe(false);
    });

    it('returns false when there are no visible meetings', () => {
      const selected = new Set(['m1']);

      expect(areAllVisibleMeetingsSelected(selected, [])).toBe(false);
    });
  });
});
