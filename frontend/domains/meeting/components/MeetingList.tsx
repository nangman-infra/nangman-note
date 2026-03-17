'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  History,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMeetings } from '../hooks/useMeeting';
import { useMeetingStatus } from '@/hooks/useMeetingStatus';
import { MeetingProcessingPhase } from '../types/meeting-processing-phase.enum';
import { MeetingStatus } from '../types/meeting.types';
import {
  MeetingActionDialog,
  type MeetingActionType,
} from './MeetingActionDialog';
import { MeetingCard } from './MeetingCard';
import { MeetingCardSkeleton } from './MeetingCardSkeleton';
import type { SidebarTimeFilter } from '@/components/layout/Sidebar';
import {
  areAllVisibleMeetingsSelected,
  pruneSelectionToVisible,
} from './meetingSelection';

/** Maps known promptId values to human-readable tag labels. */
const TAG_LABEL_MAP: Record<string, string> = {
  prompt_default_meeting: '회의록',
  prompt_default_lecture: '강의',
  prompt_default_seminar: '멘토링',
};

const TIME_FILTER_LABEL: Record<SidebarTimeFilter, string> = {
  today: '오늘',
  recent: '최근 7일',
  all: '전체',
};

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

const filters: Array<{ key: 'all' | MeetingStatus; label: string }> = [
  { key: 'all', label: '전체' },
  { key: MeetingStatus.RECORDING, label: '진행 중' },
  { key: MeetingStatus.PROCESSING, label: '정리 중' },
  { key: MeetingStatus.COMPLETED, label: '완료' },
];

const MAX_RECENT_SEARCHES = 8;
const POLL_INTERVAL_MS = 8000;

function normalizeKeyword(keyword: string) {
  return keyword.trim();
}

function isMeetingStatus(value: string): value is MeetingStatus {
  return (
    value === MeetingStatus.RECORDING ||
    value === MeetingStatus.PROCESSING ||
    value === MeetingStatus.COMPLETED
  );
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
  onTimeFilterChange,
  onTagFilterChange,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchApplied, setIsSearchApplied] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | MeetingStatus>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'longest'>('newest');
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
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [activeDescendantIndex, setActiveDescendantIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useLocalStorage<string[]>('transnote_recent_meeting_searches', []);
  const [pendingAction, setPendingAction] = useState<{
    type: MeetingActionType;
    meetingId: string;
    title: string;
    bulkCount?: number;
  } | null>(null);
  const [isActionProcessing, setIsActionProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<number | null>(null);

  // ── 다중 선택 상태 ──
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

    const timerId = window.setInterval(poll, POLL_INTERVAL_MS);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isShortcut) return;

      event.preventDefault();
      inputRef.current?.focus();
      setIsSuggestionOpen(true);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) {
        window.clearTimeout(blurTimerRef.current);
      }
    };
  }, []);

  // 선택 모드 해제 시 선택 초기화
  useEffect(() => {
    if (!selectionMode) {
      setSelectedIds(new Set()); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [selectionMode]);

  // 뷰 전환 시 선택 모드 해제
  useEffect(() => {
    setSelectionMode(false); // eslint-disable-line react-hooks/set-state-in-effect
    setSelectedIds(new Set());
  }, [showTrash]);

  // Reset active descendant when dropdown closes
  useEffect(() => {
    setActiveDescendantIndex(-1); // eslint-disable-line react-hooks/set-state-in-effect
  }, [isSuggestionOpen]);

  // Report meetings count to parent for onboarding logic
  useEffect(() => {
    onMeetingsLoaded?.({ total: meetings.length, isLoading, isSearchApplied, showTrash });
  }, [meetings.length, isLoading, isSearchApplied, showTrash, onMeetingsLoaded]);

  const searchCandidates = useMemo(() => {
    if (showTrash) {
      return recentSearches;
    }

    const titleCandidates = meetings
      .map((meeting) => normalizeKeyword(meeting.title || ''))
      .filter(Boolean);

    return [...new Set([...recentSearches, ...titleCandidates])];
  }, [meetings, recentSearches, showTrash]);

  const suggestions = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) {
      return searchCandidates.slice(0, 6);
    }

    return searchCandidates
      .filter((candidate) => candidate.toLowerCase().includes(keyword))
      .slice(0, 8);
  }, [searchCandidates, searchQuery]);

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

  // 정렬 적용 (B-3)
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

  const visibleMeetingIds = useMemo(
    () => sortedMeetings.map((meeting) => meeting.id),
    [sortedMeetings],
  );

  // Prune selection to visible meetings
  useEffect(() => {
    if (!selectionMode) return;
    setSelectedIds((prev) => pruneSelectionToVisible(prev, visibleMeetingIds)); // eslint-disable-line react-hooks/set-state-in-effect -- sync derived state
  }, [selectionMode, visibleMeetingIds]);

  // ── 다중 선택 핸들러 ──
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

  // ── 일괄 작업 핸들러 ──
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setPendingAction({
      type: 'bulk-delete',
      meetingId: '',
      title: '',
      bulkCount: selectedIds.size,
    });
  };

  const handleBulkRestore = () => {
    if (selectedIds.size === 0) return;
    setPendingAction({
      type: 'bulk-restore',
      meetingId: '',
      title: '',
      bulkCount: selectedIds.size,
    });
  };

  const handleBulkPurge = () => {
    if (selectedIds.size === 0) return;
    setPendingAction({
      type: 'bulk-purge',
      meetingId: '',
      title: '',
      bulkCount: selectedIds.size,
    });
  };

  // ── 검색 ──
  const storeRecentSearch = (keyword: string) => {
    setRecentSearches((prev) => {
      const normalized = normalizeKeyword(keyword);
      if (!normalized) return prev;

      const deduped = prev.filter((item) => item !== normalized);
      return [normalized, ...deduped].slice(0, MAX_RECENT_SEARCHES);
    });
  };

  const runSearch = (keyword: string) => {
    if (showTrash) {
      return;
    }

    const normalized = normalizeKeyword(keyword);

    if (!normalized) {
      setSearchQuery('');
      setIsSearchApplied(false);
      setIsSuggestionOpen(false);
      void fetchMeetings();
      return;
    }

    setSearchQuery(normalized);
    setIsSearchApplied(true);
    storeRecentSearch(normalized);
    setIsSuggestionOpen(false);
    void searchMeetings(normalized, 'all');
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    runSearch(searchQuery);
  };

  const handleSearchFocus = () => {
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current);
    }
    setIsSuggestionOpen(true);
  };

  const handleSearchBlur = () => {
    blurTimerRef.current = window.setTimeout(() => {
      setIsSuggestionOpen(false);
    }, 140);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSuggestionOpen || suggestions.length === 0) {
      if (event.key === 'Escape') {
        setIsSuggestionOpen(false);
        inputRef.current?.blur();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        setActiveDescendantIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0,
        );
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        setActiveDescendantIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1,
        );
        break;
      }
      case 'Enter': {
        if (activeDescendantIndex >= 0 && activeDescendantIndex < suggestions.length) {
          event.preventDefault();
          runSearch(suggestions[activeDescendantIndex]);
        }
        break;
      }
      case 'Escape': {
        event.preventDefault();
        setIsSuggestionOpen(false);
        setActiveDescendantIndex(-1);
        break;
      }
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearchApplied(false);
    setIsSuggestionOpen(false);
    if (showTrash) {
      return;
    }
    void fetchMeetings();
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    pushToast({ title: '최근 검색어를 비웠습니다', variant: 'info' });
  };

  // ── 단건 작업 핸들러 ──
  const handleDeleteMeeting = (meetingId: string) => {
    const meeting = meetings.find((item) => item.id === meetingId);
    setPendingAction({
      type: 'move-to-trash',
      meetingId,
      title: meeting?.title || '제목 없는 회의',
    });
  };

  const handleRestoreMeeting = async (meetingId: string) => {
    const restored = await restoreMeeting(meetingId);
    if (!restored) {
      pushToast({
        title: '회의 복구에 실패했습니다',
        description: '잠시 후 다시 시도해주세요.',
        variant: 'error',
      });
      return;
    }

    pushToast({
      title: '회의를 복구했습니다',
      variant: 'success',
    });
  };

  const handlePurgeMeeting = (meetingId: string) => {
    const meeting = trashMeetings.find((item) => item.id === meetingId);
    setPendingAction({
      type: 'purge',
      meetingId,
      title: meeting?.title || '제목 없는 회의',
    });
  };

  const closeActionDialog = () => {
    if (isActionProcessing) return;
    setPendingAction(null);
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setIsActionProcessing(true);

    // ── bulk 작업 ──
    if (pendingAction.type === 'bulk-delete') {
      const ids = [...selectedIds];
      const result = await bulkDeleteMeetings(ids);
      setIsActionProcessing(false);
      setPendingAction(null);

      if (!result) {
        pushToast({ title: '일괄 삭제에 실패했습니다', variant: 'error' });
        return;
      }

      if (selectedMeetingId && result.succeeded.includes(selectedMeetingId)) {
        onSelectMeeting?.(null);
      }

      setSelectedIds(new Set());
      setSelectionMode(false);
      pushToast({
        title: `${result.succeeded.length}개의 회의를 휴지통으로 이동했습니다`,
        description: result.failed.length > 0 ? `${result.failed.length}개 실패` : undefined,
        variant: result.failed.length > 0 ? 'error' : 'success',
      });
      return;
    }

    if (pendingAction.type === 'bulk-restore') {
      const ids = [...selectedIds];
      const result = await bulkRestoreMeetings(ids);
      setIsActionProcessing(false);
      setPendingAction(null);

      if (!result) {
        pushToast({ title: '일괄 복구에 실패했습니다', variant: 'error' });
        return;
      }

      setSelectedIds(new Set());
      setSelectionMode(false);
      pushToast({
        title: `${result.succeeded.length}개의 회의를 복구했습니다`,
        description: result.failed.length > 0 ? `${result.failed.length}개 실패` : undefined,
        variant: result.failed.length > 0 ? 'error' : 'success',
      });
      return;
    }

    if (pendingAction.type === 'bulk-purge') {
      const ids = [...selectedIds];
      const result = await bulkPurgeMeetings(ids);
      setIsActionProcessing(false);
      setPendingAction(null);

      if (!result) {
        pushToast({ title: '일괄 영구 삭제에 실패했습니다', variant: 'error' });
        return;
      }

      if (selectedMeetingId && result.succeeded.includes(selectedMeetingId)) {
        onSelectMeeting?.(null);
      }

      setSelectedIds(new Set());
      setSelectionMode(false);
      pushToast({
        title: `${result.succeeded.length}개의 회의를 영구 삭제했습니다`,
        description: result.failed.length > 0 ? `${result.failed.length}개 실패` : undefined,
        variant: result.failed.length > 0 ? 'error' : 'info',
      });
      return;
    }

    // ── 단건 작업 ──
    if (pendingAction.type === 'move-to-trash') {
      const deleted = await deleteMeeting(pendingAction.meetingId);
      if (!deleted) {
        setIsActionProcessing(false);
        pushToast({
          title: '회의 삭제에 실패했습니다',
          description: '잠시 후 다시 시도해주세요.',
          variant: 'error',
        });
        return;
      }

      if (selectedMeetingId === pendingAction.meetingId) {
        onSelectMeeting?.(null);
      }
      setPendingAction(null);
      setIsActionProcessing(false);
      pushToast({
        title: '회의를 휴지통으로 이동했습니다',
        variant: 'success',
      });
      return;
    }

    const purged = await purgeMeeting(pendingAction.meetingId);
    if (!purged) {
      setIsActionProcessing(false);
      pushToast({
        title: '영구 삭제에 실패했습니다',
        description: '잠시 후 다시 시도해주세요.',
        variant: 'error',
      });
      return;
    }

    if (selectedMeetingId === pendingAction.meetingId) {
      onSelectMeeting?.(null);
    }
    setPendingAction(null);
    setIsActionProcessing(false);
    pushToast({
      title: '회의를 영구 삭제했습니다',
      variant: 'info',
    });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--line-soft)] px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted">MEETINGS</p>
            <h2 className="text-lg font-semibold">
              {showTrash ? '회의 휴지통' : '회의 아카이브'}
            </h2>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-muted">
            {sortedMeetings.length}개
          </span>
        </div>

        {error ? (
          <StatusBanner
            variant="error"
            title="목록 동기화 실패"
            message="잠시 후 다시 시도해주세요. 기존 데이터는 유지됩니다."
            className="mb-3"
          />
        ) : null}

        <form onSubmit={handleSearchSubmit} className="mb-3">
          <label htmlFor="meeting-search" className="sr-only">
            회의 제목 검색
          </label>

          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-4 w-4 text-muted" />
            </span>

            <input
              ref={inputRef}
              id="meeting-search"
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              onKeyDown={handleSearchKeyDown}
              placeholder="회의 제목 또는 내용 검색"
              role="combobox"
              aria-expanded={isSuggestionOpen && suggestions.length > 0}
              aria-controls="meeting-search-listbox"
              aria-activedescendant={
                activeDescendantIndex >= 0
                  ? `meeting-search-option-${activeDescendantIndex}`
                  : undefined
              }
              aria-autocomplete="list"
              aria-haspopup="listbox"
              className={`input-shell h-11 rounded-2xl !pl-11 !pr-28 shadow-[0_8px_20px_rgba(18,33,43,0.08)] ${
                showTrash
                  ? 'bg-slate-100 opacity-60 cursor-not-allowed'
                  : 'bg-white/95'
              }`}
              disabled={showTrash}
            />

            {searchQuery ? (
              <button
                type="button"
                aria-label="검색어 지우기"
                onClick={clearSearch}
                className="absolute right-[4.7rem] top-1/2 -translate-y-1/2 rounded-full p-1 text-muted transition hover:bg-black/5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}

            <button
              type="submit"
              className="btn-neo inline-flex absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl px-2.5 py-1 text-xs"
              disabled={showTrash}
            >
              검색
            </button>

            {isSuggestionOpen && suggestions.length > 0 ? (
              <div
                id="meeting-search-listbox"
                role="listbox"
                aria-label="추천 검색어"
                className="surface-card absolute z-30 mt-2 w-full overflow-hidden border bg-white/95 p-1.5 shadow-[0_14px_28px_rgba(18,33,43,0.15)]"
              >
                <div className="mb-1 flex items-center justify-between px-2 py-1">
                  <p className="text-[11px] font-semibold tracking-wide text-muted">추천 검색어</p>
                  {recentSearches.length > 0 ? (
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={clearRecentSearches}
                      className="text-[11px] font-medium text-muted underline-offset-2 hover:underline"
                    >
                      최근 검색 지우기
                    </button>
                  ) : null}
                </div>
                <ul className="space-y-0.5">
                  {suggestions.map((suggestion, index) => {
                    const isRecent = recentSearches.includes(suggestion);
                    const isActive = index === activeDescendantIndex;
                    return (
                      <li
                        key={suggestion}
                        id={`meeting-search-option-${index}`}
                        role="option"
                        aria-selected={isActive}
                      >
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => runSearch(suggestion)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-brand/10 ${
                            isActive ? 'bg-brand/10' : ''
                          }`}
                        >
                          {isRecent ? (
                            <History className="h-3.5 w-3.5 text-muted" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 text-brand" />
                          )}
                          <span className="truncate">{suggestion}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>

          <p className="mt-1.5 text-[11px] text-muted">
            {showTrash ? '휴지통에서는 검색이 비활성화됩니다.' : '빠른 검색: Cmd/Ctrl + K'}
          </p>
        </form>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--line-soft)] px-2 py-1 text-xs text-muted">
            <SlidersHorizontal className="h-3 w-3" />
            필터
          </span>
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              disabled={showTrash}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                activeFilter === filter.key && !showTrash
                  ? 'bg-brand text-white'
                  : 'border border-[var(--line-soft)] bg-white text-muted hover:border-[var(--line-strong)]'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {filter.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setShowTrash((prev) => !prev);
              setSearchQuery('');
              setIsSearchApplied(false);
              setIsSuggestionOpen(false);
              onSelectMeeting?.(null);
            }}
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              showTrash
                ? 'bg-rose-600 text-white'
                : 'border border-[var(--line-soft)] bg-white text-muted hover:border-[var(--line-strong)]'
            }`}
          >
            <Trash2 className="h-3 w-3" />
            {showTrash ? '닫기' : '휴지통'}
          </button>

          {/* 선택 모드 토글 버튼 */}
          {sortedMeetings.length > 0 ? (
            <button
              type="button"
              onClick={toggleSelectionMode}
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                selectionMode
                  ? 'bg-brand text-white'
                  : 'border border-[var(--line-soft)] bg-white text-muted hover:border-[var(--line-strong)]'
              }`}
            >
              <CheckSquare className="h-3 w-3" />
              {selectionMode ? '선택 취소' : '선택'}
            </button>
          ) : null}
        </div>

        {/* ── 활성 필터 칩 ── */}
        {!showTrash && (timeFilter !== 'all' || tagFilter || activeFilter !== 'all' || isSearchApplied) ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted">적용 중:</span>
            {timeFilter !== 'all' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                {TIME_FILTER_LABEL[timeFilter]}
                <button
                  type="button"
                  aria-label={`${TIME_FILTER_LABEL[timeFilter]} 필터 해제`}
                  onClick={() => onTimeFilterChange?.('all')}
                  className="ml-0.5 rounded-full p-0.5 transition hover:bg-indigo-200/60"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : null}
            {tagFilter ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700">
                {TAG_LABEL_MAP[tagFilter] ?? tagFilter}
                <button
                  type="button"
                  aria-label={`${TAG_LABEL_MAP[tagFilter] ?? tagFilter} 태그 해제`}
                  onClick={() => onTagFilterChange?.(null)}
                  className="ml-0.5 rounded-full p-0.5 transition hover:bg-teal-200/60"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : null}
            {activeFilter !== 'all' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                {filters.find((f) => f.key === activeFilter)?.label ?? activeFilter}
                <button
                  type="button"
                  aria-label={`${filters.find((f) => f.key === activeFilter)?.label ?? activeFilter} 상태 필터 해제`}
                  onClick={() => setActiveFilter('all')}
                  className="ml-0.5 rounded-full p-0.5 transition hover:bg-amber-200/60"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : null}
            {isSearchApplied && searchQuery ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                &ldquo;{searchQuery}&rdquo;
                <button
                  type="button"
                  aria-label="검색어 필터 해제"
                  onClick={clearSearch}
                  className="ml-0.5 rounded-full p-0.5 transition hover:bg-violet-200/60"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : null}
          </div>
        ) : null}

        {/* 정렬 옵션 (B-3) */}
        {!showTrash && (
          <div className="mt-2 flex items-center gap-2">
            <label htmlFor="meeting-sort" className="text-[11px] text-muted">정렬:</label>
            <select
              id="meeting-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'longest')}
              className="rounded-lg border border-[var(--line-soft)] bg-white px-2 py-1 text-[11px] font-semibold text-muted"
            >
              <option value="newest">최신순</option>
              <option value="oldest">오래된순</option>
              <option value="longest">길이순</option>
            </select>
          </div>
        )}
      </header>

      {/* ── 선택 모드 툴바 ── */}
      {selectionMode ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line-soft)] bg-brand/5 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={isAllSelected ? deselectAll : selectAll}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/10"
            >
              {isAllSelected ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              {isAllSelected ? '전체 해제' : '전체 선택'}
            </button>
            <span className="text-xs font-semibold text-muted">
              {selectedIds.size}개 선택
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {showTrash ? (
              <>
                <button
                  type="button"
                  onClick={handleBulkRestore}
                  disabled={selectedIds.size === 0}
                  className="btn-neo inline-flex whitespace-nowrap px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  복구
                </button>
                <button
                  type="button"
                  onClick={handleBulkPurge}
                  disabled={selectedIds.size === 0}
                  className="btn-neo inline-flex whitespace-nowrap border-transparent bg-rose-600 px-2.5 py-1.5 text-xs text-white hover:bg-rose-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  삭제
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0}
                className="btn-neo inline-flex whitespace-nowrap border-transparent bg-rose-600 px-2.5 py-1.5 text-xs text-white hover:bg-rose-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                삭제
              </button>
            )}
          </div>
        </div>
      ) : null}

      <div className="scroll-muted flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <MeetingCardSkeleton key={i} />
            ))}
          </div>
        ) : sortedMeetings.length === 0 ? (
          <div className="surface-card p-6 text-center">
            {showTrash ? (
              <>
                <p className="mb-1 text-sm font-semibold">휴지통이 비어 있습니다</p>
                <p className="text-xs text-muted">
                  삭제한 회의가 있으면 이곳에서 복구하거나 영구 삭제할 수 있습니다.
                </p>
              </>
            ) : (
              <>
                <Search className="mx-auto mb-3 h-8 w-8 text-muted/40" />
                <p className="mb-1 text-sm font-semibold">검색 결과가 없습니다</p>
                {isSearchApplied && searchQuery ? (
                  <p className="mb-3 text-xs text-muted">
                    &ldquo;<span className="font-medium text-foreground">{searchQuery}</span>&rdquo;에 대한 결과를 찾을 수 없습니다.
                  </p>
                ) : (
                  <p className="mb-3 text-xs text-muted">
                    현재 필터 조건에 맞는 회의가 없습니다.
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {isSearchApplied ? (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="btn-neo inline-flex rounded-xl px-3 py-1.5 text-xs"
                    >
                      <X className="h-3 w-3" />
                      검색어 초기화
                    </button>
                  ) : null}
                  {(activeFilter !== 'all' || timeFilter !== 'all' || tagFilter) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFilter('all');
                      }}
                      className="btn-neo inline-flex rounded-xl px-3 py-1.5 text-xs"
                    >
                      <SlidersHorizontal className="h-3 w-3" />
                      필터 초기화
                    </button>
                  ) : null}
                </div>
                <p className="mt-3 text-[11px] text-muted">
                  다른 검색어를 입력하거나 필터를 변경해보세요.
                </p>
              </>
            )}
          </div>
        ) : (
          sortedMeetings.map((meeting, index) => (
            <div key={meeting.id} className={index < 3 ? 'motion-rise' : ''}>
              <MeetingCard
                meeting={meeting}
                mode={showTrash ? 'trash' : 'active'}
                onClick={showTrash ? undefined : () => onSelectMeeting?.(meeting.id)}
                onDelete={showTrash ? undefined : () => handleDeleteMeeting(meeting.id)}
                onRestore={showTrash ? () => void handleRestoreMeeting(meeting.id) : undefined}
                onPurge={showTrash ? () => handlePurgeMeeting(meeting.id) : undefined}
                isActive={meeting.id === selectedMeetingId}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(meeting.id)}
                onToggleSelect={() => toggleSelect(meeting.id)}
              />
            </div>
          ))
        )}
      </div>

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
