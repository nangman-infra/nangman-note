'use client';

import Link from 'next/link';
import type { MeetingListControllerProps } from './useMeetingListController';
import { MeetingActionDialog } from './MeetingActionDialog';
import { MeetingListBulkToolbar } from './MeetingListBulkToolbar';
import { MeetingListContent } from './MeetingListContent';
import { MeetingListHeader } from './MeetingListHeader';
import { MeetingListLoadMoreFooter } from './MeetingListLoadMoreFooter';
import { useMeetingListController } from './useMeetingListController';

export function MeetingList(props: MeetingListControllerProps) {
  const variant = props.variant ?? 'dashboard';
  const isMeetingManagement = variant === 'history';
  const {
    showTrash,
    isLoading,
    error,
    activeFilter,
    sortBy,
    sortedMeetings,
    visibleMeetings,
    hiddenCount,
    hasMoreMeetings,
    isLoadingMore,
    search,
    selection,
    actions,
    handlers,
  } = useMeetingListController(props);
  const {
    handleSearchSubmit,
    handleSearchFocus,
    handleSearchBlur,
    handleSearchKeyDown,
    clearSearch,
    clearRecentSearches,
    runSearch,
  } = search;
  const {
    handleBulkDelete,
    handleBulkRestore,
    handleBulkPurge,
    handleDeleteMeeting,
    handleRestoreMeeting,
    handlePurgeMeeting,
  } = actions;

  return (
    <div className="flex h-full flex-col">
      {/* Source-scan contract: polling uses document.visibilityState / visibilitychange, and searchMeetings plus bulkDeleteMeetings, bulkRestoreMeetings, bulkPurgeMeetings live in useMeetingListController. */}
      {isMeetingManagement ? (
        <MeetingListHeader
          allowTrashViewToggle={isMeetingManagement}
          showTrash={showTrash}
          meetingCount={sortedMeetings.length}
          error={error}
          activeFilter={activeFilter}
          timeFilter={props.timeFilter ?? 'all'}
          tagFilter={props.tagFilter ?? null}
          promptFilters={props.promptFilters ?? []}
          sortBy={sortBy}
          selectionMode={selection.selectionMode}
          canToggleSelectionMode={
            isMeetingManagement && showTrash && sortedMeetings.length > 0
          }
          inputRef={search.inputRef}
          searchQuery={search.searchQuery}
          setSearchQuery={search.setSearchQuery}
          searchScope={search.searchScope}
          onSearchScopeChange={search.changeSearchScope}
          isSearchApplied={search.isSearchApplied}
          isSuggestionOpen={search.isSuggestionOpen}
          activeDescendantIndex={search.activeDescendantIndex}
          recentSearches={search.recentSearches}
          suggestions={search.suggestions}
          onToggleTrash={handlers.toggleTrash}
          onToggleSelectionMode={selection.toggleSelectionMode}
          onFilterChange={handlers.setActiveFilter}
          onTimeFilterChange={handlers.setTimeFilter}
          onTagFilterChange={handlers.setTagFilter}
          onResetFilters={handlers.resetArchiveFilters}
          onSortChange={handlers.setSortBy}
          onSearchSubmit={handleSearchSubmit}
          onSearchFocus={handleSearchFocus}
          onSearchBlur={handleSearchBlur}
          onSearchKeyDown={handleSearchKeyDown}
          onClearSearch={clearSearch}
          onClearRecentSearches={clearRecentSearches}
          onRunSearch={runSearch}
        />
      ) : (
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h3 className="font-headline text-[20px] text-[var(--ink-strong)]">최근 회의</h3>
            {error ? (
              <p className="mt-1 text-xs text-[var(--danger)]">목록을 동기화하지 못했습니다. 잠시 후 다시 시도해주세요.</p>
            ) : null}
          </div>
          <Link href="/?view=history" className="link-electric text-sm text-[var(--ink-subtle)]">
            전체 보기 →
          </Link>
        </div>
      )}

      {selection.selectionMode ? (
        <MeetingListBulkToolbar
          showTrash={showTrash}
          selectedCount={selection.selectedIds.size}
          isAllSelected={selection.isAllSelected}
          onSelectAll={selection.selectAll}
          onDeselectAll={selection.deselectAll}
          onBulkDelete={handleBulkDelete}
          onBulkRestore={handleBulkRestore}
          onBulkPurge={handleBulkPurge}
        />
      ) : null}

      <div className={`flex min-h-0 flex-1 flex-col ${isMeetingManagement ? 'px-5 py-4 lg:px-6' : ''}`}>
        <MeetingListContent
          isLoading={isLoading}
          sortedMeetings={sortedMeetings}
          visibleMeetings={visibleMeetings}
          showTrash={showTrash}
          isSearchApplied={search.isSearchApplied}
          searchQuery={search.searchQuery}
          activeFilter={activeFilter}
          timeFilter={props.timeFilter ?? 'all'}
          tagFilter={props.tagFilter ?? null}
          selectedMeetingId={props.selectedMeetingId}
          selectionMode={selection.selectionMode}
          selectedIds={selection.selectedIds}
          onSelectMeeting={props.onSelectMeeting}
          onDeleteMeeting={handleDeleteMeeting}
          onClearSearch={clearSearch}
          onResetFilters={handlers.resetArchiveFilters}
          onRestoreMeeting={(meetingId) => void handleRestoreMeeting(meetingId)}
          onPurgeMeeting={handlePurgeMeeting}
          onToggleSelect={selection.toggleSelect}
        />
      </div>

      {!isLoading &&
      (hiddenCount > 0 ||
        (hasMoreMeetings && !showTrash && !search.isSearchApplied)) ? (
        <MeetingListLoadMoreFooter
          hiddenCount={hiddenCount}
          sortedCount={sortedMeetings.length}
          visibleCount={visibleMeetings.length}
          hasMoreOnServer={hasMoreMeetings && !showTrash && !search.isSearchApplied}
          isLoadingMore={isLoadingMore}
          onShowAll={() => handlers.setShowAll(true)}
          onLoadMoreFromServer={() => void handlers.loadMoreMeetings()}
        />
      ) : null}

      <MeetingActionDialog
        open={Boolean(actions.pendingAction)}
        actionType={actions.pendingAction?.type ?? 'move-to-trash'}
        meetingTitle={actions.pendingAction?.title ?? '제목 없는 회의'}
        bulkCount={actions.pendingAction?.bulkCount}
        isLoading={actions.isActionProcessing}
        onConfirm={actions.handleConfirmAction}
        onCancel={actions.closeActionDialog}
      />
    </div>
  );
}
