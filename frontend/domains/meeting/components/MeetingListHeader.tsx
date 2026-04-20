'use client';

import {
  CheckSquare,
  History,
  Search,
  Sparkles,
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

      <form onSubmit={onSearchSubmit} className="mb-3">
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
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            onKeyDown={onSearchKeyDown}
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
              showTrash ? 'bg-slate-100 opacity-60 cursor-not-allowed' : ''
            }`}
            disabled={showTrash}
          />

          {searchQuery ? (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={onClearSearch}
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
                <p className="text-[11px] font-semibold tracking-wide text-muted">
                  추천 검색어
                </p>
                {recentSearches.length > 0 ? (
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={onClearRecentSearches}
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
                        onClick={() => onRunSearch(suggestion)}
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
