'use client';

import {
  CheckSquare,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Dispatch,
  FormEvent,
  KeyboardEvent,
  RefObject,
  SetStateAction,
} from 'react';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import {
  MEETING_LIST_FILTERS,
  type MeetingFilterKey,
  type MeetingSortKey,
} from './meetingListConfig';
import { MeetingListSearchBox } from './MeetingListSearchBox';

interface MeetingListHeaderProps {
  showTrash: boolean;
  meetingCount: number;
  error: string | null;
  activeFilter: MeetingFilterKey;
  sortBy: MeetingSortKey;
  selectionMode: boolean;
  canToggleSelectionMode: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  isSearchApplied: boolean;
  isSuggestionOpen: boolean;
  activeDescendantIndex: number;
  recentSearches: string[];
  suggestions: string[];
  onToggleTrash: () => void;
  onToggleSelectionMode: () => void;
  onFilterChange: (filter: MeetingFilterKey) => void;
  onSortChange: (sortBy: MeetingSortKey) => void;
  onSearchSubmit: (event: FormEvent) => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  onSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onClearSearch: () => void;
  onClearRecentSearches: () => void;
  onRunSearch: (keyword: string) => void;
}

export function MeetingListHeader({
  showTrash,
  meetingCount,
  error,
  activeFilter,
  sortBy,
  selectionMode,
  canToggleSelectionMode,
  inputRef,
  searchQuery,
  setSearchQuery,
  isSearchApplied,
  isSuggestionOpen,
  activeDescendantIndex,
  recentSearches,
  suggestions,
  onToggleTrash,
  onToggleSelectionMode,
  onFilterChange,
  onSortChange,
  onSearchSubmit,
  onSearchFocus,
  onSearchBlur,
  onSearchKeyDown,
  onClearSearch,
  onClearRecentSearches,
  onRunSearch,
}: MeetingListHeaderProps) {
  return (
    <header className="px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="label-sm text-[var(--ink-muted)]">MEETINGS</p>
          <h2 className="truncate font-headline text-xl font-bold tracking-tight text-slate-900">
            {showTrash ? '회의 휴지통' : '회의 아카이브'}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-[var(--secondary-container)] px-2.5 py-1 text-xs font-bold text-[var(--on-secondary-container)]">
            {meetingCount}개
          </span>
          <button
            type="button"
            onClick={onToggleTrash}
            className={`rounded-full p-2 transition ${
              showTrash
                ? 'bg-rose-100 text-rose-600'
                : 'text-[var(--ink-muted)] hover:bg-slate-100'
            }`}
            title={showTrash ? '휴지통 닫기' : '휴지통'}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {canToggleSelectionMode ? (
            <button
              type="button"
              onClick={onToggleSelectionMode}
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

      <MeetingListSearchBox
        showTrash={showTrash}
        inputRef={inputRef}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSuggestionOpen={isSuggestionOpen}
        activeDescendantIndex={activeDescendantIndex}
        recentSearches={recentSearches}
        suggestions={suggestions}
        onSearchSubmit={onSearchSubmit}
        onSearchFocus={onSearchFocus}
        onSearchBlur={onSearchBlur}
        onSearchKeyDown={onSearchKeyDown}
        onClearSearch={onClearSearch}
        onClearRecentSearches={onClearRecentSearches}
        onRunSearch={onRunSearch}
      />

      <div className="flex items-center gap-1.5">
        {MEETING_LIST_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => onFilterChange(filter.key)}
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

      {!showTrash && (activeFilter !== 'all' || isSearchApplied) ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted">적용 중:</span>
          {activeFilter !== 'all' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
              {MEETING_LIST_FILTERS.find((filter) => filter.key === activeFilter)
                ?.label ?? activeFilter}
              <button
                type="button"
                aria-label={`${
                  MEETING_LIST_FILTERS.find((filter) => filter.key === activeFilter)
                    ?.label ?? activeFilter
                } 상태 필터 해제`}
                onClick={() => onFilterChange('all')}
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
                onClick={onClearSearch}
                className="ml-0.5 rounded-full p-0.5 transition hover:bg-violet-200/60"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      {!showTrash ? (
        <div className="mt-2 flex items-center justify-end gap-2">
          <p className="label-sm text-[var(--ink-muted)] tracking-widest">Sort by:</p>
          <select
            id="meeting-sort"
            value={sortBy}
            onChange={(event) => onSortChange(event.target.value as MeetingSortKey)}
            className="appearance-none border-none bg-transparent text-sm font-semibold text-indigo-700 focus:outline-none cursor-pointer"
          >
            <option value="newest">Recent First</option>
            <option value="oldest">Oldest First</option>
            <option value="longest">Longest First</option>
          </select>
        </div>
      ) : null}
    </header>
  );
}
