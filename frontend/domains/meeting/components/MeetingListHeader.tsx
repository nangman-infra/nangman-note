'use client';

import { CheckSquare } from 'lucide-react';
import type {
  Dispatch,
  FormEvent,
  KeyboardEvent,
  RefObject,
  SetStateAction,
} from 'react';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import type { SidebarTimeFilter } from '@/components/layout/Sidebar';
import type { MeetingFilterKey, MeetingSortKey } from './meetingListConfig';
import { MeetingListFilterToolbar } from './MeetingListFilterToolbar';
import { MeetingListSearchBox } from './MeetingListSearchBox';
import type { MeetingSearchScope } from './useMeetingListSearch';
import type { MeetingPromptFilterOption } from './useMeetingListController';

interface MeetingListHeaderProps {
  allowTrashViewToggle: boolean;
  showTrash: boolean;
  meetingCount: number;
  error: string | null;
  activeFilter: MeetingFilterKey;
  timeFilter: SidebarTimeFilter;
  tagFilter: string | null;
  promptFilters: MeetingPromptFilterOption[];
  sortBy: MeetingSortKey;
  selectionMode: boolean;
  canToggleSelectionMode: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  searchScope?: MeetingSearchScope;
  onSearchScopeChange?: (scope: MeetingSearchScope) => void;
  isSearchApplied: boolean;
  isSuggestionOpen: boolean;
  activeDescendantIndex: number;
  recentSearches: string[];
  suggestions: string[];
  onToggleTrash: () => void;
  onToggleSelectionMode: () => void;
  onFilterChange: (filter: MeetingFilterKey) => void;
  onTimeFilterChange: (filter: SidebarTimeFilter) => void;
  onTagFilterChange: (tag: string | null) => void;
  onResetFilters: () => void;
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
  allowTrashViewToggle,
  showTrash,
  meetingCount,
  error,
  activeFilter,
  timeFilter,
  tagFilter,
  promptFilters,
  sortBy,
  selectionMode,
  canToggleSelectionMode,
  inputRef,
  searchQuery,
  setSearchQuery,
  searchScope,
  onSearchScopeChange,
  isSearchApplied,
  isSuggestionOpen,
  activeDescendantIndex,
  recentSearches,
  suggestions,
  onToggleTrash,
  onToggleSelectionMode,
  onFilterChange,
  onTimeFilterChange,
  onTagFilterChange,
  onResetFilters,
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
    <header className="space-y-4 px-5 pb-2 pt-6 lg:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <h2 className="font-headline truncate text-[22px] text-[var(--ink-strong)]">
            {showTrash ? '휴지통' : '전체 회의'}
          </h2>
          <span className="text-sm text-[var(--ink-muted)]">{meetingCount}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {allowTrashViewToggle && showTrash ? (
            <button
              type="button"
              onClick={onToggleTrash}
              className="link-electric text-sm text-[var(--ink-subtle)]"
            >
              전체 회의로
            </button>
          ) : null}
          {allowTrashViewToggle && !showTrash ? (
            <button
              type="button"
              onClick={onToggleTrash}
              className="link-electric text-sm text-[var(--ink-subtle)]"
            >
              휴지통
            </button>
          ) : null}
          {canToggleSelectionMode ? (
            <button
              type="button"
              onClick={onToggleSelectionMode}
              className={`btn-icon inline-flex ${
                selectionMode ? '!bg-[var(--surface-container)] !text-white' : ''
              }`}
              title={selectionMode ? '선택 취소' : '선택'}
              aria-label={selectionMode ? '선택 모드 닫기' : '회의 선택 모드'}
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

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <MeetingListSearchBox
          showTrash={showTrash}
          inputRef={inputRef}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchScope={searchScope}
          onSearchScopeChange={onSearchScopeChange}
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

        {!showTrash ? (
          <label className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--surface-container-low)] px-3 text-xs text-[var(--ink-subtle)]">
            <span className="label-sm">정렬</span>
            <select
              id="meeting-sort"
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value as MeetingSortKey)}
              className="cursor-pointer appearance-none border-none bg-transparent text-xs text-[var(--ink-strong)] focus:outline-none"
              aria-label="회의 정렬"
            >
              <option value="newest">최근 순</option>
              <option value="oldest">오래된 순</option>
              <option value="longest">긴 회의 순</option>
            </select>
          </label>
        ) : null}
      </div>

      <MeetingListFilterToolbar
        showTrash={showTrash}
        activeFilter={activeFilter}
        timeFilter={timeFilter}
        tagFilter={tagFilter}
        promptFilters={promptFilters}
        isSearchApplied={isSearchApplied}
        searchQuery={searchQuery}
        onFilterChange={onFilterChange}
        onTimeFilterChange={onTimeFilterChange}
        onTagFilterChange={onTagFilterChange}
        onResetFilters={onResetFilters}
        onClearSearch={onClearSearch}
      />
    </header>
  );
}
