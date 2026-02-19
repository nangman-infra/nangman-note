'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { History, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMeetings } from '../hooks/useMeeting';
import { MeetingStatus } from '../types/meeting.types';
import { MeetingCard } from './MeetingCard';

interface MeetingListProps {
  onSelectMeeting?: (meetingId: string) => void;
  selectedMeetingId?: string;
}

const filters: Array<{ key: 'all' | MeetingStatus; label: string }> = [
  { key: 'all', label: '전체' },
  { key: MeetingStatus.RECORDING, label: '진행 중' },
  { key: MeetingStatus.PROCESSING, label: '정리 중' },
  { key: MeetingStatus.COMPLETED, label: '완료' },
];

const MAX_RECENT_SEARCHES = 8;

function normalizeKeyword(keyword: string) {
  return keyword.trim();
}

export function MeetingList({ onSelectMeeting, selectedMeetingId }: MeetingListProps) {
  const { meetings, isLoading, error, fetchMeetings, searchMeetings } = useMeetings();
  const { pushToast } = useFeedback();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | MeetingStatus>('all');
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useLocalStorage<string[]>('transnote_recent_meeting_searches', []);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<number | null>(null);

  useEffect(() => {
    void fetchMeetings();
  }, [fetchMeetings]);

  useEffect(() => {
    if (!error) return;
    pushToast({
      title: '회의 데이터를 불러오는 중 오류가 발생했습니다',
      description: error,
      variant: 'error',
    });
  }, [error, pushToast]);

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
    const titleCandidates = meetings
      .map((meeting) => normalizeKeyword(meeting.title || ''))
      .filter(Boolean);

    return [...new Set([...recentSearches, ...titleCandidates])];
  }, [meetings, recentSearches]);

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
    if (activeFilter === 'all') return meetings;
    return meetings.filter((meeting) => meeting.status === activeFilter);
  }, [activeFilter, meetings]);

  const storeRecentSearch = (keyword: string) => {
    setRecentSearches((prev) => {
      const normalized = normalizeKeyword(keyword);
      if (!normalized) return prev;

      const deduped = prev.filter((item) => item !== normalized);
      return [normalized, ...deduped].slice(0, MAX_RECENT_SEARCHES);
    });
  };

  const runSearch = (keyword: string) => {
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
    void searchMeetings(normalized);
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
    void fetchMeetings();
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    pushToast({ title: '최근 검색어를 비웠습니다', variant: 'info' });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--line-soft)] px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted">MEETINGS</p>
            <h2 className="text-lg font-semibold">회의 아카이브</h2>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-muted">{meetings.length}개</span>
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

          <p className="mt-1.5 text-[11px] text-muted">빠른 검색: Cmd/Ctrl + K</p>
        </form>

        <div className="scroll-muted flex items-center gap-2 overflow-x-auto pb-1">
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line-soft)] px-2 py-1 text-xs text-muted">
            <SlidersHorizontal className="h-3 w-3" />
            필터
          </span>
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                activeFilter === filter.key
                  ? 'bg-brand text-white'
                  : 'border border-[var(--line-soft)] bg-white text-muted hover:border-[var(--line-strong)]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </header>

      <div className="scroll-muted flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="surface-card p-6 text-center text-sm text-muted">회의를 불러오는 중입니다...</div>
        ) : filteredMeetings.length === 0 ? (
          <div className="surface-card p-6 text-center">
            <p className="mb-1 text-sm font-semibold">표시할 회의가 없습니다</p>
            <p className="text-xs text-muted">검색어를 비우거나 다른 필터를 선택해보세요.</p>
          </div>
        ) : (
          filteredMeetings.map((meeting, index) => (
            <div key={meeting.id} className={index < 3 ? 'motion-rise' : ''}>
              <MeetingCard
                meeting={meeting}
                onClick={() => onSelectMeeting?.(meeting.id)}
                isActive={meeting.id === selectedMeetingId}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
