'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import type { SidebarTimeFilter } from '@/components/layout/Sidebar';
import {
  MEETING_LIST_FILTERS,
  type MeetingFilterKey,
} from './meetingListConfig';
import type { MeetingPromptFilterOption } from './useMeetingListController';

const TIME_FILTERS: Array<{ key: SidebarTimeFilter; label: string }> = [
  { key: 'all', label: '전체 기간' },
  { key: 'today', label: '오늘' },
  { key: 'recent', label: '최근 7일' },
];

interface MeetingListFilterToolbarProps {
  showTrash: boolean;
  activeFilter: MeetingFilterKey;
  timeFilter: SidebarTimeFilter;
  tagFilter: string | null;
  promptFilters: MeetingPromptFilterOption[];
  isSearchApplied: boolean;
  searchQuery: string;
  onFilterChange: (filter: MeetingFilterKey) => void;
  onTimeFilterChange: (filter: SidebarTimeFilter) => void;
  onTagFilterChange: (tag: string | null) => void;
  onResetFilters: () => void;
  onClearSearch: () => void;
}

export function MeetingListFilterToolbar({
  showTrash,
  activeFilter,
  timeFilter,
  tagFilter,
  promptFilters,
  isSearchApplied,
  searchQuery,
  onFilterChange,
  onTimeFilterChange,
  onTagFilterChange,
  onResetFilters,
  onClearSearch,
}: MeetingListFilterToolbarProps) {
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const activeFilterLabel =
    MEETING_LIST_FILTERS.find((filter) => filter.key === activeFilter)?.label ??
    activeFilter;
  const timeFilterLabel =
    TIME_FILTERS.find((filter) => filter.key === timeFilter)?.label ?? timeFilter;
  const activePromptLabel =
    promptFilters.find((prompt) => prompt.id === tagFilter)?.name ?? '프롬프트';
  const hasAdvancedFilter = timeFilter !== 'all' || Boolean(tagFilter);
  const hasAppliedFilter = activeFilter !== 'all' || isSearchApplied || hasAdvancedFilter;
  const shouldShowAdvancedFilter = isAdvancedFilterOpen || hasAdvancedFilter;

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsAdvancedFilterOpen((prev) => !prev)}
          disabled={showTrash}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
            hasAdvancedFilter && !showTrash
              ? 'bg-brand text-white shadow-md shadow-brand/10'
              : 'bg-[var(--surface-container-low)] text-[var(--ink-subtle)] hover:bg-[var(--surface-container-high)]'
          } disabled:cursor-not-allowed disabled:opacity-50`}
          aria-expanded={shouldShowAdvancedFilter}
          aria-controls="meeting-advanced-filters"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          세부 필터
        </button>
        <div className="scroll-muted flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5">
          {MEETING_LIST_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => onFilterChange(filter.key)}
              disabled={showTrash}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                activeFilter === filter.key && !showTrash
                  ? 'bg-brand text-white shadow-md shadow-brand/10'
                  : 'bg-[var(--surface-container-low)] text-[var(--ink-subtle)] hover:bg-[var(--surface-container-high)]'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {shouldShowAdvancedFilter && !showTrash ? (
        <div
          id="meeting-advanced-filters"
          className="grid gap-3 rounded-xl bg-[var(--surface-container-low)] p-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] md:items-end"
        >
          <div>
            <p className="label-sm mb-2 text-[var(--ink-muted)]">기간</p>
            <div className="flex flex-wrap gap-1.5">
              {TIME_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => onTimeFilterChange(filter.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    timeFilter === filter.key
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-[var(--ink-subtle)] hover:bg-white/70'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="label-sm mb-2 block text-[var(--ink-muted)]">
              프롬프트
            </span>
            <select
              value={tagFilter ?? ''}
              onChange={(event) => onTagFilterChange(event.target.value || null)}
              className="input-shell h-10 rounded-xl text-sm"
            >
              <option value="">전체 프롬프트</option>
              {promptFilters.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {!showTrash && hasAppliedFilter ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[var(--surface-container-low)] px-3 py-2">
          <span className="text-[11px] font-semibold text-muted">적용 중</span>
          <AppliedFilterChip
            visible={activeFilter !== 'all'}
            label={activeFilterLabel}
            tone="amber"
            ariaLabel={`${activeFilterLabel} 상태 필터 해제`}
            onClear={() => onFilterChange('all')}
          />
          <AppliedFilterChip
            visible={timeFilter !== 'all'}
            label={timeFilterLabel}
            tone="indigo"
            ariaLabel={`${timeFilterLabel} 기간 필터 해제`}
            onClear={() => onTimeFilterChange('all')}
          />
          <AppliedFilterChip
            visible={Boolean(tagFilter)}
            label={activePromptLabel}
            tone="teal"
            ariaLabel={`${activePromptLabel} 프롬프트 필터 해제`}
            onClear={() => onTagFilterChange(null)}
          />
          <AppliedFilterChip
            visible={isSearchApplied && Boolean(searchQuery)}
            label={`"${searchQuery}"`}
            tone="violet"
            ariaLabel="검색어 필터 해제"
            onClear={onClearSearch}
          />
          {activeFilter !== 'all' || hasAdvancedFilter ? (
            <button
              type="button"
              onClick={onResetFilters}
              className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-white hover:text-indigo-700"
            >
              필터 초기화
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function AppliedFilterChip({
  visible,
  label,
  tone,
  ariaLabel,
  onClear,
}: {
  visible: boolean;
  label: string;
  tone: 'amber' | 'indigo' | 'teal' | 'violet';
  ariaLabel: string;
  onClear: () => void;
}) {
  if (!visible) return null;

  const toneClassName = {
    amber: 'text-amber-700 hover:bg-amber-200/60',
    indigo: 'text-indigo-700 hover:bg-indigo-100',
    teal: 'text-teal-700 hover:bg-teal-100',
    violet: 'text-violet-700 hover:bg-violet-200/60',
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold shadow-sm ${toneClassName}`}
    >
      {label}
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onClear}
        className="ml-0.5 rounded-full p-0.5 transition"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
