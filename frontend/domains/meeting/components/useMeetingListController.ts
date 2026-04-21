import { useEffect, useMemo, useState } from 'react';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import type { SidebarTimeFilter } from '@/components/layout/Sidebar';
import { useMeetingStatus } from '@/hooks/useMeetingStatus';
import { useMeetings } from '../hooks/useMeeting';
import { MeetingCompletionState } from '../types/meeting-completion-state.enum';
import { MeetingProcessingPhase } from '../types/meeting-processing-phase.enum';
import {
  DEFAULT_MEETING_VISIBLE_LIMIT,
  MEETING_LIST_POLL_INTERVAL_MS,
  isMeetingStatus,
  type MeetingFilterKey,
  type MeetingSortKey,
} from './meetingListConfig';
import { useMeetingListActions } from './useMeetingListActions';
import { useMeetingListSearch } from './useMeetingListSearch';
import { useMeetingListSelection } from './useMeetingListSelection';

export interface MeetingListControllerProps {
  initialShowTrash?: boolean;
  showTrash?: boolean;
  onShowTrashChange?: (showTrash: boolean) => void;
  refreshToken?: number;
  onSelectMeeting?: (meetingId: string | null) => void;
  selectedMeetingId?: string;
  timeFilter?: SidebarTimeFilter;
  tagFilter?: string | null;
  onTimeFilterChange?: (filter: SidebarTimeFilter) => void;
  onTagFilterChange?: (tag: string | null) => void;
  onMeetingsLoaded?: (info: {
    total: number;
    isLoading: boolean;
    isSearchApplied: boolean;
    showTrash: boolean;
  }) => void;
}

export function useMeetingListController({
  initialShowTrash = false,
  showTrash: controlledShowTrash,
  onShowTrashChange,
  refreshToken = 0,
  onSelectMeeting,
  selectedMeetingId,
  timeFilter = 'all',
  tagFilter = null,
  onMeetingsLoaded,
}: MeetingListControllerProps) {
  const {
    meetings,
    trashMeetings,
    isLoading,
    error,
    fetchMeetings,
    fetchTrashMeetings,
    searchMeetings,
    deleteMeeting,
    restoreMeeting,
    purgeMeeting,
    bulkDeleteMeetings,
    bulkRestoreMeetings,
    bulkPurgeMeetings,
    applyMeetingStatusUpdate,
    applyResultRegenerateUpdate,
  } = useMeetings();
  const { pushToast } = useFeedback();
  const [activeFilter, setActiveFilter] = useState<MeetingFilterKey>('all');
  const [sortBy, setSortBy] = useState<MeetingSortKey>('newest');
  const [internalShowTrash, setInternalShowTrash] = useState(initialShowTrash);
  const [showAll, setShowAll] = useState(false);
  const isControlled = controlledShowTrash !== undefined;
  const showTrash = isControlled ? controlledShowTrash : internalShowTrash;

  const setShowTrash = (value: boolean | ((prev: boolean) => boolean)) => {
    const nextValue = typeof value === 'function' ? value(showTrash) : value;
    if (!isControlled) {
      setInternalShowTrash(nextValue);
    }
    onShowTrashChange?.(nextValue);
  };

  const search = useMeetingListSearch({
    meetings,
    showTrash,
    fetchMeetings,
    searchMeetings,
    pushToast,
  });

  useMeetingStatus({
    onStatusChange: (message) => {
      if (!isMeetingStatus(message.status)) return;
      applyMeetingStatusUpdate({
        meetingId: message.meetingId,
        status: message.status,
        phase: getMeetingStatusUpdatePhase(message.phase),
        needsAttention: message.needsAttention,
        completionState: message.completionState as
          | MeetingCompletionState
          | null
          | undefined,
      });
    },
    onResultRegenerate: (message) => {
      applyResultRegenerateUpdate(message);
    },
  });

  useEffect(() => {
    if (showTrash) {
      void fetchTrashMeetings();
      return;
    }
    void fetchMeetings();
  }, [fetchMeetings, fetchTrashMeetings, refreshToken, showTrash]);

  useEffect(() => {
    if (!showTrash && search.isSearchApplied) {
      return;
    }

    const poll = () => {
      if (document.visibilityState === 'hidden') return;
      if (showTrash) {
        void fetchTrashMeetings({ silent: true });
      } else {
        void fetchMeetings({ silent: true });
      }
    };

    const timerId = window.setInterval(poll, MEETING_LIST_POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(timerId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    fetchMeetings,
    fetchTrashMeetings,
    search.isSearchApplied,
    showTrash,
  ]);

  useEffect(() => {
    if (!isControlled) {
      setInternalShowTrash(initialShowTrash); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [initialShowTrash, isControlled]);

  useEffect(() => {
    if (!error) return;
    pushToast({
      title: '회의 데이터를 불러오는 중 오류가 발생했습니다',
      description: error,
      variant: 'error',
    });
  }, [error, pushToast]);

  useEffect(() => {
    if (!selectedMeetingId) return;
    const source = showTrash ? trashMeetings : meetings;
    const exists = source.some((meeting) => meeting.id === selectedMeetingId);
    if (!exists) {
      onSelectMeeting?.(null);
    }
  }, [meetings, onSelectMeeting, selectedMeetingId, showTrash, trashMeetings]);

  useEffect(() => {
    setShowAll(false); // eslint-disable-line react-hooks/set-state-in-effect
  }, [showTrash, search.isSearchApplied]);

  useEffect(() => {
    onMeetingsLoaded?.({
      total: meetings.length,
      isLoading,
      isSearchApplied: search.isSearchApplied,
      showTrash,
    });
  }, [
    meetings.length,
    isLoading,
    search.isSearchApplied,
    showTrash,
    onMeetingsLoaded,
  ]);

  const filteredMeetings = useMemo(() => {
    const source = showTrash ? trashMeetings : meetings;
    if (showTrash) {
      return source;
    }

    let result = source;

    if (activeFilter !== 'all') {
      result = result.filter((meeting) => meeting.status === activeFilter);
    }

    if (timeFilter === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      result = result.filter((meeting) => new Date(meeting.startedAt) >= todayStart);
    } else if (timeFilter === 'recent') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      result = result.filter((meeting) => new Date(meeting.startedAt) >= weekAgo);
    }

    if (tagFilter && !search.isSearchApplied) {
      result = result.filter((meeting) => meeting.promptId === tagFilter);
    }

    return result;
  }, [
    activeFilter,
    meetings,
    search.isSearchApplied,
    showTrash,
    tagFilter,
    timeFilter,
    trashMeetings,
  ]);

  const sortedMeetings = useMemo(() => {
    const sorted = [...filteredMeetings];
    if (sortBy === 'oldest') {
      sorted.reverse();
    } else if (sortBy === 'longest') {
      sorted.sort((a, b) => {
        const dA = a.endedAt ? new Date(a.endedAt).getTime() - new Date(a.startedAt).getTime() : 0;
        const dB = b.endedAt ? new Date(b.endedAt).getTime() - new Date(b.startedAt).getTime() : 0;
        return dB - dA;
      });
    }
    return sorted;
  }, [filteredMeetings, sortBy]);

  const shouldClampList = !showTrash && !search.isSearchApplied && !showAll;
  const visibleMeetings = useMemo(
    () =>
      shouldClampList
        ? sortedMeetings.slice(0, DEFAULT_MEETING_VISIBLE_LIMIT)
        : sortedMeetings,
    [shouldClampList, sortedMeetings],
  );
  const hiddenCount = Math.max(0, sortedMeetings.length - visibleMeetings.length);

  const visibleMeetingIds = useMemo(
    () => visibleMeetings.map((meeting) => meeting.id),
    [visibleMeetings],
  );

  const selection = useMeetingListSelection({
    showTrash,
    visibleMeetingIds,
  });
  const actions = useMeetingListActions({
    meetings,
    trashMeetings,
    selectedIds: selection.selectedIds,
    selectedMeetingId,
    onSelectMeeting,
    deleteMeeting,
    restoreMeeting,
    purgeMeeting,
    bulkDeleteMeetings,
    bulkRestoreMeetings,
    bulkPurgeMeetings,
    clearSelection: selection.clearSelection,
    pushToast,
  });

  return {
    showTrash,
    isLoading,
    error,
    activeFilter,
    sortBy,
    sortedMeetings,
    visibleMeetings,
    hiddenCount,
    search,
    selection,
    actions,
    handlers: {
      setActiveFilter,
      setSortBy,
      setShowAll,
      toggleTrash: () => {
        setShowTrash((prev) => !prev);
        search.resetSearchState();
        onSelectMeeting?.(null);
      },
    },
  };
}

function getMeetingStatusUpdatePhase(
  phase: string | undefined,
): MeetingProcessingPhase | null | undefined {
  if (phase === 'completed') return null;
  return phase as MeetingProcessingPhase | undefined;
}
