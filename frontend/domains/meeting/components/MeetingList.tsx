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
/** 메인 뷰에서 기본적으로 보여주는 회의 개수. 초과분은 "더보기"로 펼친다. */
const DEFAULT_VISIBLE_LIMIT = 10;

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
        completionState: message.completionState,
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

  // 뷰 전환·검색 적용 시 "모두 보기" 상태를 초기화 → 다시 상위 10개만 노출
  useEffect(() => {
    setShowAll(false); // eslint-disable-line react-hooks/set-state-in-effect
  }, [showTrash, isSearchApplied]);

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
      shouldClampList ? sortedMeetings.slice(0, DEFAULT_VISIBLE_LIMIT) : sortedMeetings,
    [shouldClampList, sortedMeetings],
  );
  const hiddenCount = Math.max(0, sortedMeetings.length - visibleMeetings.length);

  const visibleMeetingIds = useMemo(
    () => visibleMeetings.map((meeting) => meeting.id),
    [visibleMeetings],
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
  // 현재 메인 목록에서는 카드 내 삭제 버튼을 노출하지 않지만, 회의 상세 화면 등
  // 향후 단건 삭제 경로에서 재사용하기 위해 핸들러는 유지한다. 이로 인한 unused
  // 경고는 의도된 사용 지연이므로 무시한다.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      <header className="px-5 py-4">
        {/* ── Header row: title + count + action icons ── */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="label-sm text-[var(--ink-muted)]">MEETINGS</p>
            <h2 className="truncate font-headline text-xl font-bold tracking-tight text-slate-900">
              {showTrash ? '회의 휴지통' : '회의 아카이브'}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="rounded-full bg-[var(--secondary-container)] px-2.5 py-1 text-xs font-bold text-[var(--on-secondary-container)]">
              {sortedMeetings.length}개
            </span>
            {/* Trash toggle — small icon button */}
            <button
              type="button"
              onClick={() => {
                setShowTrash((prev) => !prev);
                setSearchQuery('');
                setIsSearchApplied(false);
                setIsSuggestionOpen(false);
                onSelectMeeting?.(null);
              }}
              className={`rounded-full p-2 transition ${
                showTrash
                  ? 'bg-rose-100 text-rose-600'
                  : 'text-[var(--ink-muted)] hover:bg-slate-100'
              }`}
              title={showTrash ? '휴지통 닫기' : '휴지통'}
            >
              <Trash2 className="h-4 w-4" />
            </button>
            {/* Selection mode toggle — 휴지통 뷰에서만 노출.
                메인 활성 뷰에서는 단건 삭제(카드 안 🗑)만 지원해 경로를 단일화한다. */}
            {showTrash && sortedMeetings.length > 0 ? (
              <button
                type="button"
                onClick={toggleSelectionMode}
                className={`rounded-full p-2 transition ${
                  selectionMode
                    ? 'bg-brand/10 text-brand'
                    : 'text-[var(--ink-muted)] hover:bg-slate-100'
                }`}
                title={selectionMode ? '선택 취소' : '선택'}
              >
                <CheckSquare className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <StatusBanner
            variant="error"
            title="목록 동기화 실패"
            message="잠시 후 다시 시도해주세요. 기존 데이터는 유지됩니다."
            className="mb-3"
          />
        ) : null}

        {/* ── Search ── */}
        <form onSubmit={handleSearchSubmit} className="mb-3">
          <label htmlFor="meeting-search" className="sr-only">
            회의 제목 검색
          </label>

          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
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
              placeholder="검색 (⌘K)"
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
              className={`input-shell h-9 rounded-full text-sm !pl-9 !pr-8 ${
                showTrash
                  ? 'bg-slate-100 opacity-60 cursor-not-allowed'
                  : ''
              }`}
              disabled={showTrash}
            />

            {searchQuery ? (
              <button
                type="button"
                aria-label="검색어 지우기"
                onClick={clearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[var(--ink-muted)] transition hover:bg-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}

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
        </form>

        {/* ── Simple tag pill filters: 전체 | 진행 중 | 정리 중 | 완료 ── */}
        <div className="flex items-center gap-1.5">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              disabled={showTrash}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                activeFilter === filter.key && !showTrash
                  ? 'bg-brand text-white shadow-md'
                  : 'bg-[var(--surface-container-highest)] text-[var(--ink-subtle)] hover:bg-[var(--outline-variant)]/30'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* ── Active filter chips (search, status) ── */}
        {!showTrash && (activeFilter !== 'all' || isSearchApplied) ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted">적용 중:</span>
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

        {/* Sort */}
        {!showTrash && (
          <div className="mt-2 flex items-center justify-end gap-2">
            <p className="label-sm text-[var(--ink-muted)] tracking-widest">Sort by:</p>
            <select
              id="meeting-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'longest')}
              className="appearance-none border-none bg-transparent text-sm font-semibold text-indigo-700 focus:outline-none cursor-pointer"
            >
              <option value="newest">Recent First</option>
              <option value="oldest">Oldest First</option>
              <option value="longest">Longest First</option>
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

      <div
        className="scroll-muted flex-1 space-y-1.5 overflow-y-auto px-4 py-3"
      >
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
          <>
            {visibleMeetings.map((meeting, index) => (
              <div key={meeting.id} className={index < 3 ? 'motion-rise' : ''}>
                <MeetingCard
                  meeting={meeting}
                  mode={showTrash ? 'trash' : 'active'}
                  onClick={showTrash ? undefined : () => onSelectMeeting?.(meeting.id)}
                  // 메인(활성) 뷰에서는 카드 내 삭제 버튼을 노출하지 않는다.
                  // 삭제는 회의 상세/휴지통 뷰를 통해서만 수행해 경로를 단일화한다.
                  onDelete={undefined}
                  onRestore={showTrash ? () => void handleRestoreMeeting(meeting.id) : undefined}
                  onPurge={showTrash ? () => handlePurgeMeeting(meeting.id) : undefined}
                  isActive={meeting.id === selectedMeetingId}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.has(meeting.id)}
                  onToggleSelect={() => toggleSelect(meeting.id)}
                />
              </div>
            ))}
          </>
        )}
      </div>

      {/* 더보기 영역 — 스크롤 컨테이너 밖에 고정 배치해 리스트 길이와 무관하게 항상 노출. */}
      {!isLoading && hiddenCount > 0 ? (
        <div className="shrink-0 border-t border-[var(--line-soft)] bg-[var(--bg-card)] px-4 py-2.5">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="btn-neo inline-flex w-full justify-center rounded-xl px-3 py-2 text-xs font-semibold"
          >
            더보기 ({hiddenCount}개)
          </button>
          <p className="mt-1.5 text-center text-[11px] text-muted">
            전체 {sortedMeetings.length}개 중 최근 {visibleMeetings.length}개 · 검색으로도 찾을 수 있어요
          </p>
        </div>
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
