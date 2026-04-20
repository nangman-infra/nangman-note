'use client';

import { useEffect, useState } from 'react';
import {
  areAllVisibleMeetingsSelected,
  pruneSelectionToVisible,
} from './meetingSelection';

interface UseMeetingListSelectionParams {
  showTrash: boolean;
  visibleMeetingIds: string[];
}

export function useMeetingListSelection({
  showTrash,
  visibleMeetingIds,
}: UseMeetingListSelectionParams) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!selectionMode) {
      setSelectedIds(new Set()); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [selectionMode]);

  useEffect(() => {
    setSelectionMode(false); // eslint-disable-line react-hooks/set-state-in-effect
    setSelectedIds(new Set());
  }, [showTrash]);

  useEffect(() => {
    if (!selectionMode) return;
    setSelectedIds((prev) => pruneSelectionToVisible(prev, visibleMeetingIds)); // eslint-disable-line react-hooks/set-state-in-effect
  }, [selectionMode, visibleMeetingIds]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(visibleMeetingIds));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const isAllSelected = areAllVisibleMeetingsSelected(
    selectedIds,
    visibleMeetingIds,
  );

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => !prev);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  return {
    selectionMode,
    selectedIds,
    setSelectedIds,
    setSelectionMode,
    toggleSelect,
    selectAll,
    deselectAll,
    isAllSelected,
    toggleSelectionMode,
    clearSelection,
  };
}
