'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { History, Search, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMeetings } from '../hooks/useMeeting';
import { MeetingStatus } from '../types/meeting.types';
import {
  MeetingActionDialog,
  type MeetingActionType,
} from './MeetingActionDialog';
import { MeetingCard } from './MeetingCard';

interface MeetingListProps {
  initialShowTrash?: boolean;
  refreshToken?: number;
  onSelectMeeting?: (meetingId: string | null) => void;
  selectedMeetingId?: string;
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

export function MeetingList({
  initialShowTrash = false,
  refreshToken = 0,
  onSelectMeeting,
  selectedMeetingId,
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
  } = useMeetings();
  const { pushToast } = useFeedback();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | MeetingStatus>('all');
  const [showTrash, setShowTrash] = useState(initialShowTrash);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useLocalStorage<string[]>('transnote_recent_meeting_searches', []);
  const [pendingAction, setPendingAction] = useState<{
    type: MeetingActionType;
    meetingId: string;
    title: string;
  } | null>(null);
  const [isActionProcessing, setIsActionProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (showTrash) {
      void fetchTrashMeetings();
      return;
    }
    void fetchMeetings();
  }, [fetchMeetings, fetchTrashMeetings, refreshToken, showTrash]);

  useEffect(() => {
    if (!showTrash && searchQuery.trim().length > 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      if (showTrash) {
        void fetchTrashMeetings({ silent: true });
        return;
      }
      void fetchMeetings({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, [fetchMeetings, fetchTrashMeetings, searchQuery, showTrash]);

  useEffect(() => {
    setShowTrash(initialShowTrash);
  }, [initialShowTrash]);

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
    if (activeFilter === 'all') return source;
    return source.filter((meeting) => meeting.status === activeFilter);
  }, [activeFilter, meetings, showTrash, trashMeetings]);

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
      setIsSuggestionOpen(false);
      void fetchMeetings();
      return;
    }

    setSearchQuery(normalized);
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

  const clearSearch = () => {
    setSearchQuery('');
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
            {filteredMeetings.length}개
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
              placeholder="회의 제목 또는 내용 검색"
              className="input-shell h-11 rounded-2xl bg-white/95 !pl-11 !pr-28 shadow-[0_8px_20px_rgba(18,33,43,0.08)]"
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
              className="btn-neo absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl px-2.5 py-1 text-xs"
              disabled={showTrash}
            >
              검색
            </button>

            {isSuggestionOpen && suggestions.length > 0 ? (
              <div className="surface-card absolute z-30 mt-2 w-full overflow-hidden border bg-white/95 p-1.5 shadow-[0_14px_28px_rgba(18,33,43,0.15)]">
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
                  {suggestions.map((suggestion) => {
                    const isRecent = recentSearches.includes(suggestion);
                    return (
                      <li key={suggestion}>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => runSearch(suggestion)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-brand/10"
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
        </div>
      </header>

      <div className="scroll-muted flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="surface-card p-6 text-center text-sm text-muted">회의를 불러오는 중입니다...</div>
        ) : filteredMeetings.length === 0 ? (
          <div className="surface-card p-6 text-center">
            <p className="mb-1 text-sm font-semibold">
              {showTrash ? '휴지통이 비어 있습니다' : '표시할 회의가 없습니다'}
            </p>
            <p className="text-xs text-muted">
              {showTrash
                ? '삭제한 회의가 있으면 이곳에서 복구하거나 영구 삭제할 수 있습니다.'
                : '검색어를 비우거나 다른 필터를 선택해보세요.'}
            </p>
          </div>
        ) : (
          filteredMeetings.map((meeting, index) => (
            <div key={meeting.id} className={index < 3 ? 'motion-rise' : ''}>
              <MeetingCard
                meeting={meeting}
                mode={showTrash ? 'trash' : 'active'}
                onClick={showTrash ? undefined : () => onSelectMeeting?.(meeting.id)}
                onDelete={showTrash ? undefined : () => handleDeleteMeeting(meeting.id)}
                onRestore={showTrash ? () => void handleRestoreMeeting(meeting.id) : undefined}
                onPurge={showTrash ? () => handlePurgeMeeting(meeting.id) : undefined}
                isActive={meeting.id === selectedMeetingId}
              />
            </div>
          ))
        )}
      </div>

      <MeetingActionDialog
        open={Boolean(pendingAction)}
        actionType={pendingAction?.type ?? 'move-to-trash'}
        meetingTitle={pendingAction?.title ?? '제목 없는 회의'}
        isLoading={isActionProcessing}
        onConfirm={handleConfirmAction}
        onCancel={closeActionDialog}
      />
    </div>
  );
}
