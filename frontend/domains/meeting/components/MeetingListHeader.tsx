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
    <header className="space-y-3 border-b border-[var(--line-soft)] bg-white/95 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="label-sm text-[var(--ink-muted)]">MEETINGS</p>
          <h2 className="truncate font-headline text-xl font-bold tracking-tight text-slate-900">
            {showTrash ? '회의 휴지통' : '회의 아카이브'}
          </h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {showTrash
              ? '삭제된 회의를 복구하거나 영구 삭제할 수 있어요.'
              : '최근 회의와 처리 상태를 빠르게 확인하세요.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-[var(--secondary-container)] px-3 py-1.5 text-xs font-bold text-[var(--on-secondary-container)]">
            {meetingCount}개
          </span>
          {allowTrashViewToggle && showTrash ? (
            <button
              type="button"
              onClick={onToggleTrash}
              className="rounded-full bg-[var(--surface-container-low)] px-3 py-1.5 text-xs font-bold text-[var(--ink-subtle)] transition hover:bg-[var(--surface-container-high)]"
            >
              아카이브로
            </button>
          ) : null}
          {allowTrashViewToggle && !showTrash ? (
            <button
              type="button"
              onClick={onToggleTrash}
              className="rounded-full bg-[var(--surface-container-low)] px-3 py-1.5 text-xs font-bold text-[var(--ink-subtle)] transition hover:bg-[var(--surface-container-high)]"
            >
              삭제한 회의
            </button>
          ) : null}
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
          <label className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--surface-container-low)] px-3 text-xs font-semibold text-[var(--ink-subtle)]">
            <span className="text-xs font-semibold text-[var(--ink-muted)]">정렬</span>
            <select
              id="meeting-sort"
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value as MeetingSortKey)}
              className="cursor-pointer appearance-none border-none bg-transparent text-xs font-bold text-indigo-700 focus:outline-none"
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
