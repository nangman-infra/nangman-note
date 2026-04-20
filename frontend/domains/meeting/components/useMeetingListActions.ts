'use client';

import { useState } from 'react';
import type { Meeting } from '../types/meeting.types';
import type { MeetingActionType } from './MeetingActionDialog';

type BulkResult = {
  succeeded: string[];
  failed: string[];
};

type PushToast = (options: {
  title: string;
  description?: string;
  variant?: 'success' | 'error' | 'info';
}) => void;

interface UseMeetingListActionsParams {
  meetings: Meeting[];
  trashMeetings: Meeting[];
  selectedIds: Set<string>;
  selectedMeetingId?: string;
  onSelectMeeting?: (meetingId: string | null) => void;
  deleteMeeting: (id: string) => Promise<boolean>;
  restoreMeeting: (id: string) => Promise<boolean>;
  purgeMeeting: (id: string) => Promise<boolean>;
  bulkDeleteMeetings: (ids: string[]) => Promise<BulkResult | null>;
  bulkRestoreMeetings: (ids: string[]) => Promise<BulkResult | null>;
  bulkPurgeMeetings: (ids: string[]) => Promise<BulkResult | null>;
  clearSelection: () => void;
  pushToast: PushToast;
}

interface PendingMeetingAction {
  type: MeetingActionType;
  meetingId: string;
  title: string;
  bulkCount?: number;
}

export function useMeetingListActions({
  meetings,
  trashMeetings,
  selectedIds,
  selectedMeetingId,
  onSelectMeeting,
  deleteMeeting,
  restoreMeeting,
  purgeMeeting,
  bulkDeleteMeetings,
  bulkRestoreMeetings,
  bulkPurgeMeetings,
  clearSelection,
  pushToast,
}: UseMeetingListActionsParams) {
  const [pendingAction, setPendingAction] =
    useState<PendingMeetingAction | null>(null);
  const [isActionProcessing, setIsActionProcessing] = useState(false);

  const openBulkAction = (
    type: Extract<
      MeetingActionType,
      'bulk-delete' | 'bulk-restore' | 'bulk-purge'
    >,
  ) => {
    if (selectedIds.size === 0) return;
    setPendingAction({
      type,
      meetingId: '',
      title: '',
      bulkCount: selectedIds.size,
    });
  };

  const handleBulkDelete = () => openBulkAction('bulk-delete');
  const handleBulkRestore = () => openBulkAction('bulk-restore');
  const handleBulkPurge = () => openBulkAction('bulk-purge');

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

  const handleBulkDeleteConfirm = async () => {
    const ids = [...selectedIds];
    const result = await bulkDeleteMeetings(ids);
    setIsActionProcessing(false);
    setPendingAction(null);

    if (!result) {
      pushToast({ title: '일괄 삭제에 실패했습니다', variant: 'error' });
      return;
    }

    if (selectedMeetingId && result.succeeded.includes(selectedMeetingId)) {
      onSelectMeeting?.(null);
    }

    clearSelection();
    pushToast({
      title: `${result.succeeded.length}개의 회의를 휴지통으로 이동했습니다`,
      description:
        result.failed.length > 0 ? `${result.failed.length}개 실패` : undefined,
      variant: result.failed.length > 0 ? 'error' : 'success',
    });
  };

  const handleBulkRestoreConfirm = async () => {
    const ids = [...selectedIds];
    const result = await bulkRestoreMeetings(ids);
    setIsActionProcessing(false);
    setPendingAction(null);

    if (!result) {
      pushToast({ title: '일괄 복구에 실패했습니다', variant: 'error' });
      return;
    }

    clearSelection();
    pushToast({
      title: `${result.succeeded.length}개의 회의를 복구했습니다`,
      description:
        result.failed.length > 0 ? `${result.failed.length}개 실패` : undefined,
      variant: result.failed.length > 0 ? 'error' : 'success',
    });
  };

  const handleBulkPurgeConfirm = async () => {
    const ids = [...selectedIds];
    const result = await bulkPurgeMeetings(ids);
    setIsActionProcessing(false);
    setPendingAction(null);

    if (!result) {
      pushToast({ title: '일괄 영구 삭제에 실패했습니다', variant: 'error' });
      return;
    }

    if (selectedMeetingId && result.succeeded.includes(selectedMeetingId)) {
      onSelectMeeting?.(null);
    }

    clearSelection();
    pushToast({
      title: `${result.succeeded.length}개의 회의를 영구 삭제했습니다`,
      description:
        result.failed.length > 0 ? `${result.failed.length}개 실패` : undefined,
      variant: result.failed.length > 0 ? 'error' : 'info',
    });
  };

  const handleMoveToTrashConfirm = async (meetingId: string) => {
    const deleted = await deleteMeeting(meetingId);
    if (!deleted) {
      setIsActionProcessing(false);
      pushToast({
        title: '회의 삭제에 실패했습니다',
        description: '잠시 후 다시 시도해주세요.',
        variant: 'error',
      });
      return;
    }

    if (selectedMeetingId === meetingId) {
      onSelectMeeting?.(null);
    }
    setPendingAction(null);
    setIsActionProcessing(false);
    pushToast({
      title: '회의를 휴지통으로 이동했습니다',
      variant: 'success',
    });
  };

  const handlePurgeConfirm = async (meetingId: string) => {
    const purged = await purgeMeeting(meetingId);
    if (!purged) {
      setIsActionProcessing(false);
      pushToast({
        title: '영구 삭제에 실패했습니다',
        description: '잠시 후 다시 시도해주세요.',
        variant: 'error',
      });
      return;
    }

    if (selectedMeetingId === meetingId) {
      onSelectMeeting?.(null);
    }
    setPendingAction(null);
    setIsActionProcessing(false);
    pushToast({
      title: '회의를 영구 삭제했습니다',
      variant: 'info',
    });
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setIsActionProcessing(true);

    if (pendingAction.type === 'bulk-delete') {
      await handleBulkDeleteConfirm();
      return;
    }

    if (pendingAction.type === 'bulk-restore') {
      await handleBulkRestoreConfirm();
      return;
    }

    if (pendingAction.type === 'bulk-purge') {
      await handleBulkPurgeConfirm();
      return;
    }

    if (pendingAction.type === 'move-to-trash') {
      await handleMoveToTrashConfirm(pendingAction.meetingId);
      return;
    }

    await handlePurgeConfirm(pendingAction.meetingId);
  };

  return {
    pendingAction,
    isActionProcessing,
    handleBulkDelete,
    handleBulkRestore,
    handleBulkPurge,
    handleDeleteMeeting,
    handleRestoreMeeting,
    handlePurgeMeeting,
    closeActionDialog,
    handleConfirmAction,
  };
}
