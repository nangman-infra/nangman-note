'use client';

import Link from 'next/link';
import { Mic, Search, SlidersHorizontal, X } from 'lucide-react';
import type { SidebarTimeFilter } from '@/components/layout/Sidebar';
import { MeetingStatus, type Meeting } from '../types/meeting.types';
import { MeetingCard } from './MeetingCard';
import { MeetingCardSkeleton } from './MeetingCardSkeleton';

interface MeetingListContentProps {
  isLoading: boolean;
  sortedMeetings: Meeting[];
  visibleMeetings: Meeting[];
  showTrash: boolean;
  isSearchApplied: boolean;
  searchQuery: string;
  activeFilter: 'all' | MeetingStatus;
  timeFilter: SidebarTimeFilter;
  tagFilter: string | null;
  selectedMeetingId?: string;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onSelectMeeting?: (meetingId: string | null) => void;
  onDeleteMeeting: (meetingId: string) => void;
  onClearSearch: () => void;
  onResetFilters: () => void;
  onRestoreMeeting: (meetingId: string) => void;
  onPurgeMeeting: (meetingId: string) => void;
  onToggleSelect: (meetingId: string) => void;
}

export function MeetingListContent({
  isLoading,
  sortedMeetings,
  visibleMeetings,
  showTrash,
  isSearchApplied,
  searchQuery,
  activeFilter,
  timeFilter,
  tagFilter,
  selectedMeetingId,
  selectionMode,
  selectedIds,
  onSelectMeeting,
  onDeleteMeeting,
  onClearSearch,
  onResetFilters,
  onRestoreMeeting,
  onPurgeMeeting,
  onToggleSelect,
}: MeetingListContentProps) {
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <MeetingCardSkeleton key={index} />
          ))}
        </div>
      );
    }

    if (sortedMeetings.length === 0) {
      return (
        <MeetingListEmptyState
          showTrash={showTrash}
          isSearchApplied={isSearchApplied}
          searchQuery={searchQuery}
          hasAnyFilter={
            activeFilter !== 'all' || timeFilter !== 'all' || Boolean(tagFilter)
          }
          onClearSearch={onClearSearch}
          onResetFilters={onResetFilters}
        />
      );
    }

    return (
      <>
        {visibleMeetings.map((meeting, index) => (
          <div key={meeting.id} className={index < 3 ? 'motion-rise' : ''}>
            <MeetingCard
              meeting={meeting}
              mode={showTrash ? 'trash' : 'active'}
              onClick={showTrash ? undefined : () => onSelectMeeting?.(meeting.id)}
              onDelete={
                showTrash || selectionMode
                  ? undefined
                  : () => onDeleteMeeting(meeting.id)
              }
              onRestore={
                showTrash ? () => onRestoreMeeting(meeting.id) : undefined
              }
              onPurge={showTrash ? () => onPurgeMeeting(meeting.id) : undefined}
              isActive={meeting.id === selectedMeetingId}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(meeting.id)}
              onToggleSelect={() => onToggleSelect(meeting.id)}
            />
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="scroll-muted flex-1 space-y-2 overflow-y-auto bg-white px-4 py-3">
      {renderContent()}
    </div>
  );
}

function MeetingListEmptyState({
  showTrash,
  isSearchApplied,
  searchQuery,
  hasAnyFilter,
  onClearSearch,
  onResetFilters,
}: {
  showTrash: boolean;
  isSearchApplied: boolean;
  searchQuery: string;
  hasAnyFilter: boolean;
  onClearSearch: () => void;
  onResetFilters: () => void;
}) {
  const isFirstArchiveEmpty = !showTrash && !isSearchApplied && !hasAnyFilter;

  if (showTrash) {
    return (
      <div className="surface-card bg-[var(--surface-container-low)] p-6 text-center">
        <p className="mb-1 text-sm font-semibold">휴지통이 비어 있습니다</p>
        <p className="text-xs text-muted">
          삭제한 회의가 있으면 이곳에서 복구하거나 영구 삭제할 수 있습니다.
        </p>
      </div>
    );
  }

  if (isFirstArchiveEmpty) {
    return (
      <div className="surface-card bg-[var(--surface-container-low)] p-6 text-center">
        <Mic className="mx-auto mb-3 h-8 w-8 text-indigo-600/70" />
        <p className="mb-1 text-sm font-semibold">아직 기록된 회의가 없습니다</p>
        <p className="mx-auto mb-4 max-w-sm text-xs leading-relaxed text-muted">
          첫 회의를 시작하면 이곳에 회의 기록과 AI 회의록이 시간순으로 쌓입니다.
        </p>
        <Link href="/meeting/new" className="btn-primary inline-flex px-3 py-2 text-xs">
          <Mic className="h-3.5 w-3.5" />
          첫 회의 시작하기
        </Link>
      </div>
    );
  }

  return (
    <div className="surface-card bg-[var(--surface-container-low)] p-6 text-center">
      <Search className="mx-auto mb-3 h-8 w-8 text-muted/40" />
      <p className="mb-1 text-sm font-semibold">
        {isSearchApplied ? '검색 결과가 없습니다' : '조건에 맞는 회의가 없습니다'}
      </p>
      {isSearchApplied && searchQuery ? (
        <p className="mb-3 text-xs text-muted">
          &ldquo;
          <span className="font-medium text-foreground">{searchQuery}</span>
          &rdquo;에 대한 결과를 찾을 수 없습니다.
        </p>
      ) : (
        <p className="mb-3 text-xs text-muted">
          필터를 초기화하면 전체 회의 아카이브를 다시 볼 수 있습니다.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {isSearchApplied ? (
          <button
            type="button"
            onClick={onClearSearch}
            className="btn-neo inline-flex rounded-xl px-3 py-1.5 text-xs"
          >
            <X className="h-3 w-3" />
            검색어 초기화
          </button>
        ) : null}
        {hasAnyFilter ? (
          <button
            type="button"
            onClick={onResetFilters}
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
    </div>
  );
}
