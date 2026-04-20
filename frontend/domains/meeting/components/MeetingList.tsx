'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { useMeetings } from '../hooks/useMeeting';
import { useMeetingStatus } from '@/hooks/useMeetingStatus';
import { MeetingCompletionState } from '../types/meeting-completion-state.enum';
import { MeetingProcessingPhase } from '../types/meeting-processing-phase.enum';
import { MeetingActionDialog } from './MeetingActionDialog';
import type { SidebarTimeFilter } from '@/components/layout/Sidebar';
import { MeetingListBulkToolbar } from './MeetingListBulkToolbar';
import { MeetingListContent } from './MeetingListContent';
import { MeetingListHeader } from './MeetingListHeader';
import { MeetingListLoadMoreFooter } from './MeetingListLoadMoreFooter';
import {
  DEFAULT_MEETING_VISIBLE_LIMIT,
  MEETING_LIST_POLL_INTERVAL_MS,
  isMeetingStatus,
  type MeetingFilterKey,
  type MeetingSortKey,
} from './meetingListConfig';
import { useMeetingListSearch } from './useMeetingListSearch';
import { useMeetingListActions } from './useMeetingListActions';
import { useMeetingListSelection } from './useMeetingListSelection';

interface MeetingListProps {
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
  onMeetingsLoaded?: (info: { total: number; isLoading: boolean; isSearchApplied: boolean; showTrash: boolean }) => void;
}

export function MeetingList({
  initialShowTrash = false,
  showTrash: controlledShowTrash,
  onShowTrashChange,
  refreshToken = 0,
  onSelectMeeting,
  selectedMeetingId,
  timeFilter = 'all',
  tagFilter = null,
  onMeetingsLoaded,
}: MeetingListProps) {
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
  const isControlled = controlledShowTrash !== undefined;
  const showTrash = isControlled ? controlledShowTrash : internalShowTrash;
  const setShowTrash = (value: boolean | ((prev: boolean) => boolean)) => {
    const nextValue = typeof value === 'function' ? value(showTrash) : value;
    if (!isControlled) {
      setInternalShowTrash(nextValue);
    }
    onShowTrashChange?.(nextValue);
  };
  const {
    inputRef,
    searchQuery,
    setSearchQuery,
    isSearchApplied,
    isSuggestionOpen,
    activeDescendantIndex,
    recentSearches,
    suggestions,
    resetSearchState,
    runSearch,
    handleSearchSubmit,
    handleSearchFocus,
    handleSearchBlur,
    handleSearchKeyDown,
    clearSearch,
    clearRecentSearches,
  } = useMeetingListSearch({
    meetings,
    showTrash,
    fetchMeetings,
    searchMeetings,
    pushToast,
  });

  // ── "모두 보기" 토글 (메인 활성 뷰 전용) ──
  // 기본값 false: 상위 DEFAULT_VISIBLE_LIMIT개만 노출. 사용자가 명시적으로
  // 펼치면 true. 검색/휴지통/뷰 전환 시 자동으로 접힌다(아래 useEffect 참고).
  const [showAll, setShowAll] = useState(false);

  useMeetingStatus({
    onStatusChange: (message) => {
      if (!isMeetingStatus(message.status)) return;
      applyMeetingStatusUpdate({
        meetingId: message.meetingId,
        status: message.status,
        phase:
          message.phase === 'completed'
            ? null
            : (message.phase as MeetingProcessingPhase | undefined),
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
    if (!showTrash && isSearchApplied) {
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
  }, [fetchMeetings, fetchTrashMeetings, isSearchApplied, showTrash]);

  // Sync controlled prop → internal state
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

  // 뷰 전환·검색 적용 시 "모두 보기" 상태를 초기화 → 다시 상위 10개만 노출
  useEffect(() => {
    setShowAll(false); // eslint-disable-line react-hooks/set-state-in-effect
  }, [showTrash, isSearchApplied]);

  // Report meetings count to parent for onboarding logic
  useEffect(() => {
    onMeetingsLoaded?.({ total: meetings.length, isLoading, isSearchApplied, showTrash });
  }, [meetings.length, isLoading, isSearchApplied, showTrash, onMeetingsLoaded]);

  const filteredMeetings = useMemo(() => {
    const source = showTrash ? trashMeetings : meetings;
    if (showTrash) {
      return source;
    }

    let result = source;

    if (activeFilter !== 'all') {
      result = result.filter((m) => m.status === activeFilter);
    }

    if (timeFilter === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      result = result.filter((m) => new Date(m.startedAt) >= todayStart);
    } else if (timeFilter === 'recent') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      result = result.filter((m) => new Date(m.startedAt) >= weekAgo);
    }

    if (tagFilter && !isSearchApplied) {
      result = result.filter((m) => m.promptId === tagFilter);
    }

    return result;
  }, [activeFilter, meetings, isSearchApplied, showTrash, tagFilter, timeFilter, trashMeetings]);

  // 정렬 적용
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

  // 메인(활성) 뷰에서는 기본적으로 상위 DEFAULT_VISIBLE_LIMIT개만 노출한다.
  // 휴지통 뷰·검색 중에는 전체 노출(사용자가 의도적으로 찾고 있으므로 가리지 않는다).
  // 사용자가 "모두 보기"를 누르면(showAll=true) 활성 뷰에서도 전체를 펼친다.
  const shouldClampList = !showTrash && !isSearchApplied && !showAll;
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

  const {
    selectionMode,
    selectedIds,
    toggleSelect,
    selectAll,
    deselectAll,
    isAllSelected,
    toggleSelectionMode,
    clearSelection,
  } = useMeetingListSelection({
    showTrash,
    visibleMeetingIds,
  });
  const {
    pendingAction,
    isActionProcessing,
    handleBulkDelete,
    handleBulkRestore,
    handleBulkPurge,
    handleRestoreMeeting,
    handlePurgeMeeting,
    closeActionDialog,
    handleConfirmAction,
  } = useMeetingListActions({
    meetings,
    trashMeetings,
    selectedIds,
    selectedMeetingId,
    onSelectMeeting,
    deleteMeeting,
    restoreMeeting,
    purgeMeeting,
    bulkDeleteMeetings,
    bulkRestoreMeetings,
    bulkPurgeMeetings,
    clearSelection,
    pushToast,
  });

  return (
    <div className="flex h-full flex-col">
      <MeetingListHeader
        showTrash={showTrash}
        meetingCount={sortedMeetings.length}
        error={error}
        activeFilter={activeFilter}
        sortBy={sortBy}
        selectionMode={selectionMode}
        canToggleSelectionMode={showTrash && sortedMeetings.length > 0}
        inputRef={inputRef}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearchApplied={isSearchApplied}
        isSuggestionOpen={isSuggestionOpen}
        activeDescendantIndex={activeDescendantIndex}
        recentSearches={recentSearches}
        suggestions={suggestions}
        onToggleTrash={() => {
          setShowTrash((prev) => !prev);
          resetSearchState();
          onSelectMeeting?.(null);
        }}
        onToggleSelectionMode={toggleSelectionMode}
        onFilterChange={setActiveFilter}
        onSortChange={setSortBy}
        onSearchSubmit={handleSearchSubmit}
        onSearchFocus={handleSearchFocus}
        onSearchBlur={handleSearchBlur}
        onSearchKeyDown={handleSearchKeyDown}
        onClearSearch={clearSearch}
        onClearRecentSearches={clearRecentSearches}
        onRunSearch={runSearch}
      />

      {selectionMode ? (
        <MeetingListBulkToolbar
          showTrash={showTrash}
          selectedCount={selectedIds.size}
          isAllSelected={isAllSelected}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onBulkDelete={handleBulkDelete}
          onBulkRestore={handleBulkRestore}
          onBulkPurge={handleBulkPurge}
        />
      ) : null}

      <MeetingListContent
        isLoading={isLoading}
        sortedMeetings={sortedMeetings}
        visibleMeetings={visibleMeetings}
        showTrash={showTrash}
        isSearchApplied={isSearchApplied}
        searchQuery={searchQuery}
        activeFilter={activeFilter}
        timeFilter={timeFilter}
        tagFilter={tagFilter}
        selectedMeetingId={selectedMeetingId}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onSelectMeeting={onSelectMeeting}
        onClearSearch={clearSearch}
        onResetStatusFilter={() => setActiveFilter('all')}
        onRestoreMeeting={(meetingId) => void handleRestoreMeeting(meetingId)}
        onPurgeMeeting={handlePurgeMeeting}
        onToggleSelect={toggleSelect}
      />

      {!isLoading && hiddenCount > 0 ? (
        <MeetingListLoadMoreFooter
          hiddenCount={hiddenCount}
          sortedCount={sortedMeetings.length}
          visibleCount={visibleMeetings.length}
          onShowAll={() => setShowAll(true)}
        />
      ) : null}

      <MeetingActionDialog
        open={Boolean(pendingAction)}
        actionType={pendingAction?.type ?? 'move-to-trash'}
        meetingTitle={pendingAction?.title ?? '제목 없는 회의'}
        bulkCount={pendingAction?.bulkCount}
        isLoading={isActionProcessing}
        onConfirm={handleConfirmAction}
        onCancel={closeActionDialog}
      />
    </div>
  );
}
