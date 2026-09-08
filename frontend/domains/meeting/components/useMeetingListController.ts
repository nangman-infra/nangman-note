import { useEffect, useMemo, useState } from 'react';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import type { SidebarTimeFilter } from '@/components/layout/Sidebar';
import { useAuthReady } from '@/hooks/useAuthReady';
import { useMeetingStatus } from '@/hooks/useMeetingStatus';
import { useMeetings } from '../hooks/useMeeting';
import { MeetingCompletionState } from '../types/meeting-completion-state.enum';
import { MeetingProcessingPhase } from '../types/meeting-processing-phase.enum';
import {
  DEFAULT_MEETING_VISIBLE_LIMIT,
  MEETING_LIST_POLL_INTERVAL_CONNECTED_MS,
  MEETING_LIST_POLL_INTERVAL_MS,
  isMeetingStatus,
  type MeetingFilterKey,
  type MeetingSortKey,
} from './meetingListConfig';
import { useMeetingListActions } from './useMeetingListActions';
import { useMeetingListSearch } from './useMeetingListSearch';
import { useMeetingListSelection } from './useMeetingListSelection';

export interface MeetingListControllerProps {
  variant?: 'dashboard' | 'history';
  initialShowTrash?: boolean;
  showTrash?: boolean;
  onShowTrashChange?: (showTrash: boolean) => void;
  refreshToken?: number;
  onSelectMeeting?: (meetingId: string | null) => void;
  selectedMeetingId?: string;
  timeFilter?: SidebarTimeFilter;
  tagFilter?: string | null;
  promptFilters?: MeetingPromptFilterOption[];
  onTimeFilterChange?: (filter: SidebarTimeFilter) => void;
  onTagFilterChange?: (tag: string | null) => void;
  onMeetingsLoaded?: (info: {
    total: number;
    isLoading: boolean;
    isSearchApplied: boolean;
    showTrash: boolean;
  }) => void;
}

export interface MeetingPromptFilterOption {
  id: string;
  name: string;
}

export function useMeetingListController({
  variant = 'dashboard',
  initialShowTrash = false,
  showTrash: controlledShowTrash,
  onShowTrashChange,
  refreshToken = 0,
  onSelectMeeting,
  selectedMeetingId,
  timeFilter = 'all',
  tagFilter = null,
  onTimeFilterChange,
  onTagFilterChange,
  onMeetingsLoaded,
}: MeetingListControllerProps) {
  const {
    meetings,
    trashMeetings,
    meetingsTotal,
    hasMoreMeetings,
    isLoadingMore,
    isLoading,
    hasLoadedMeetings,
    hasLoadedTrashMeetings,
    error,
    fetchMeetings,
    loadMoreMeetings,
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

  const { isConnected: isStatusSocketConnected } = useMeetingStatus({
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

  // 인증이 준비되기 전(세션 로딩/만료)에는 목록 요청·폴링을 시작하지 않는다.
  // 토큰 없는 요청은 apiClient 가 거절하지만, 여기서 막아야 불필요한 rejected promise 와
  // 재인증 트리거 반복을 피할 수 있다.
  const isAuthReady = useAuthReady();

  useEffect(() => {
    if (!isAuthReady) return;
    if (showTrash) {
      void fetchTrashMeetings();
      return;
    }
    void fetchMeetings();
  }, [isAuthReady, fetchMeetings, fetchTrashMeetings, refreshToken, showTrash]);

  useEffect(() => {
    if (!isAuthReady) return;
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

    // 실시간 소켓이 살아있으면 폴링은 안전망 역할만 하므로 주기를 늘린다.
    const intervalMs = isStatusSocketConnected
      ? MEETING_LIST_POLL_INTERVAL_CONNECTED_MS
      : MEETING_LIST_POLL_INTERVAL_MS;
    const timerId = window.setInterval(poll, intervalMs);

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
    isAuthReady,
    isStatusSocketConnected,
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
    // Don't judge while the list is still loading (e.g. a deep link like
    // /?meeting=<id> arrives before the first fetch resolves).
    if (isLoading) return;
    // Cold mount(새 탭/새로고침 deep-link)에서는 최초 fetch 가 시작되기 전에
    // 빈 목록으로 판정해 deselect 하면 안 된다 — 최초 로드 성공 이후에만 판정.
    if (showTrash ? !hasLoadedTrashMeetings : !hasLoadedMeetings) return;
    // A paginated list may simply not contain an older meeting yet.
    if (!showTrash && hasMoreMeetings) return;
    const source = showTrash ? trashMeetings : meetings;
    const exists = source.some((meeting) => meeting.id === selectedMeetingId);
    if (!exists) {
      onSelectMeeting?.(null);
    }
  }, [
    hasLoadedMeetings,
    hasLoadedTrashMeetings,
    hasMoreMeetings,
    isLoading,
    meetings,
    onSelectMeeting,
    selectedMeetingId,
    showTrash,
    trashMeetings,
  ]);

  useEffect(() => {
    setShowAll(false); // eslint-disable-line react-hooks/set-state-in-effect
  }, [showTrash, search.isSearchApplied]);

  // 첫 로드가 끝나기 전(세션 준비 대기 포함)에는 "0개"가 아니라 "로딩 중"으로 보고한다.
  // 그렇지 않으면 상위에서 onboarding 으로 전환되며 이 컴포넌트가 unmount 되어
  // fetch 가 영원히 시작되지 않는 레이스가 생긴다.
  const isInitialLoadPending = !showTrash && !hasLoadedMeetings;

  useEffect(() => {
    onMeetingsLoaded?.({
      // 서버 total 우선 — 로드된 페이지 창 크기(50)가 전체 개수로 보이지 않게 한다.
      total: meetingsTotal ?? meetings.length,
      isLoading: isLoading || isInitialLoadPending,
      isSearchApplied: search.isSearchApplied,
      showTrash,
    });
  }, [
    meetings.length,
    meetingsTotal,
    isLoading,
    isInitialLoadPending,
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

    if (tagFilter) {
      result = result.filter((meeting) => meeting.promptId === tagFilter);
    }

    return result;
  }, [
    activeFilter,
    meetings,
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

  const isDashboardPreview = variant === 'dashboard';
  const shouldClampList =
    isDashboardPreview && !showTrash && !search.isSearchApplied && !showAll;
  const visibleMeetings = useMemo(
    () =>
      shouldClampList
        ? sortedMeetings.slice(0, DEFAULT_MEETING_VISIBLE_LIMIT)
        : sortedMeetings,
    [shouldClampList, sortedMeetings],
  );
  const hiddenCount = Math.max(0, sortedMeetings.length - visibleMeetings.length);

  const handleStatusFilterChange = (filter: MeetingFilterKey) => {
    setActiveFilter(filter);
    setShowAll(false);
  };

  const handleTimeFilterChange = (filter: SidebarTimeFilter) => {
    onTimeFilterChange?.(filter);
    setShowAll(false);
  };

  const handleTagFilterChange = (tag: string | null) => {
    onTagFilterChange?.(tag);
    setShowAll(false);
  };

  const resetArchiveFilters = () => {
    setActiveFilter('all');
    onTimeFilterChange?.('all');
    onTagFilterChange?.(null);
    setShowAll(false);
  };

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
    hasMoreMeetings,
    isLoadingMore,
    search,
    selection,
    actions,
    handlers: {
      setActiveFilter: handleStatusFilterChange,
      setSortBy,
      setShowAll,
      setTimeFilter: handleTimeFilterChange,
      setTagFilter: handleTagFilterChange,
      resetArchiveFilters,
      loadMoreMeetings,
      toggleTrash: () => {
        setShowTrash((prev) => !prev);
        search.resetSearchState();
        // In controlled mode the parent owns showTrash (URL-driven) and its
        // onShowTrashChange navigation already clears the selected meeting;
        // deselecting here would race with that navigation.
        if (!isControlled) {
          onSelectMeeting?.(null);
        }
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
