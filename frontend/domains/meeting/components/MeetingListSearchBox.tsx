'use client';

import { History, Search, Sparkles, X } from 'lucide-react';
import type {
  Dispatch,
  FormEvent,
  KeyboardEvent,
  RefObject,
  SetStateAction,
} from 'react';
import {
  MEETING_SEARCH_SCOPE_OPTIONS,
  type MeetingSearchScope,
} from './useMeetingListSearch';

interface MeetingListSearchBoxProps {
  showTrash: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  searchScope?: MeetingSearchScope;
  onSearchScopeChange?: (scope: MeetingSearchScope) => void;
  isSuggestionOpen: boolean;
  activeDescendantIndex: number;
  recentSearches: string[];
  suggestions: string[];
  onSearchSubmit: (event: FormEvent) => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  onSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onClearSearch: () => void;
  onClearRecentSearches: () => void;
  onRunSearch: (keyword: string) => void;
}

export function MeetingListSearchBox({
  showTrash,
  inputRef,
  searchQuery,
  setSearchQuery,
  searchScope = 'all',
  onSearchScopeChange,
  isSuggestionOpen,
  activeDescendantIndex,
  recentSearches,
  suggestions,
  onSearchSubmit,
  onSearchFocus,
  onSearchBlur,
  onSearchKeyDown,
  onClearSearch,
  onClearRecentSearches,
  onRunSearch,
}: MeetingListSearchBoxProps) {
  return (
    <form onSubmit={onSearchSubmit} className="min-w-0">
      <label htmlFor="meeting-search" className="sr-only">
        회의 제목과 내용 검색
      </label>

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
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
          placeholder={showTrash ? '휴지통에서는 검색할 수 없어요' : '회의 제목과 내용 검색 (⌘K)'}
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
          className={`input-shell h-10 rounded-full text-sm !pl-10 !pr-8 ${
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
            className="surface-card absolute z-30 mt-2 w-full overflow-hidden bg-white/95 p-1.5 shadow-[0_14px_28px_rgba(18,33,43,0.15)]"
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

        {onSearchScopeChange ? (
          <select
            value={searchScope}
            onChange={(event) =>
              onSearchScopeChange(event.target.value as MeetingSearchScope)
            }
            disabled={showTrash}
            aria-label="검색 범위"
            className="input-shell h-10 shrink-0 rounded-full !px-3 text-xs font-semibold disabled:opacity-60"
          >
            {MEETING_SEARCH_SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </form>
  );
}
