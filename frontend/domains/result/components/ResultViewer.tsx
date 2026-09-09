'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { copyToClipboard } from '@/lib/utils/markdown';
import { useResult } from '../hooks/useResult';
import { useResultTabData } from '../hooks/useResultTabData';
import { ResultRegenerateConfirmDialog } from './ResultRegenerateConfirmDialog';
import { ResultRegeneratePanel } from './ResultRegeneratePanel';
import { ResultTabNav } from './ResultTabNav';
import { ResultViewerHeader } from './ResultViewerHeader';
import { ResultViewerTabContent } from './ResultViewerTabContent';
import {
  ResultViewerEmptyState,
  ResultViewerLoadingState,
} from './ResultViewerStates';
import type { ResultPromptOption, ResultTab } from './resultViewerTypes';

interface ResultViewerProps {
  meetingId: string;
  onMeetingUnavailable?: (meetingId: string) => void;
  promptOptions?: ResultPromptOption[];
  onTitleUpdate: (meetingId: string, title: string) => Promise<boolean>;
  notePanel?: ReactNode;
  beforeRegenerate?: () => Promise<boolean>;
}

export function ResultViewer({
  meetingId,
  onMeetingUnavailable,
  promptOptions = [],
  onTitleUpdate,
  notePanel,
  beforeRegenerate,
}: ResultViewerProps) {
  const {
    result,
    isLoading,
    isRegenerating,
    isPending,
    isMissingMeeting,
    error,
    updateResult,
    regenerateResult,
    exportPDF,
    exportDOCX,
    exportMD,
  } = useResult(meetingId);

  const { pushToast } = useFeedback();
  const [activeTab, setActiveTab] = useState<ResultTab>('result');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [regeneratePromptId, setRegeneratePromptId] = useState('');
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isExporting, setIsExporting] = useState<'pdf' | 'docx' | 'md' | null>(null);
  const regenerateDialogRef = useRef<HTMLDialogElement>(null);

  const {
    visibleTranscripts,
    visibleNoteContent,
    visibleTranscriptError,
    visibleNoteError,
  } = useResultTabData({
    meetingId,
    resultId: result?.id,
    resultUpdatedAt: result?.updatedAt,
    isPending,
  });

  useEffect(() => {
    if (!error) return;
    pushToast({
      title: '회의록 작업 중 오류가 발생했습니다',
      description: error,
      variant: 'error',
    });
  }, [error, pushToast]);

  useEffect(() => {
    if (!isMissingMeeting) return;
    pushToast({
      title: '선택한 회의를 찾을 수 없습니다',
      description: '이미 삭제되었거나 접근 권한이 없습니다.',
      variant: 'info',
    });
    onMeetingUnavailable?.(meetingId);
  }, [isMissingMeeting, meetingId, onMeetingUnavailable, pushToast]);

  // Regenerate confirmation dialog open/close
  useEffect(() => {
    const dialog = regenerateDialogRef.current;
    if (!dialog) return;
    if (showRegenerateConfirm) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [showRegenerateConfirm]);

  const resolvedRegeneratePromptId =
    regeneratePromptId || result?.promptId || promptOptions[0]?.id || '';
  // 참가자 아바타 스택 — transcript의 speakerLabel에서 유추 (메타데이터에 participants 필드 없음)
  const uniqueSpeakers = Array.from(
    new Set(
      visibleTranscripts
        .map((s) => s.speakerLabel?.trim())
        .filter((label): label is string => Boolean(label && label.length > 0)),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const visibleSpeakers = uniqueSpeakers.slice(0, 3);
  const overflowSpeakerCount = Math.max(uniqueSpeakers.length - 3, 0);

  if (isLoading) {
    return <ResultViewerLoadingState />;
  }

  if (!result) {
    return (
      <div className="flex h-full flex-col overflow-y-auto">
        <div className={notePanel && !isMissingMeeting ? 'shrink-0' : 'h-full'}>
          <ResultViewerEmptyState isPending={isPending} isMissingMeeting={isMissingMeeting} />
        </div>
        {notePanel && !isMissingMeeting && <div className="min-h-[480px] flex-1">{notePanel}</div>}
      </div>
    );
  }

  const handleTitleClick = () => {
    setEditTitle(result.metadata?.title || '');
    setIsEditingTitle(true);
  };

  const handleTitleSave = async () => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setIsEditingTitle(false);
      return;
    }
    try {
      const success = await onTitleUpdate(meetingId, trimmed);
      if (!success) throw new Error('Failed to update meeting title');
      setIsEditingTitle(false);
      pushToast({ title: '제목이 변경되었습니다', variant: 'success' });
    } catch {
      pushToast({ title: '제목 변경에 실패했습니다', variant: 'error' });
    }
  };

  const handleSave = async () => {
    const success = await updateResult(editContent);
    if (!success) return;

    setIsEditing(false);
    pushToast({
      title: '회의록 편집 내용이 저장되었습니다',
      variant: 'success',
    });
  };

  const handleStartEdit = () => {
    setEditContent(result.content);
    setIsEditing(true);
  };

  const handleCopy = async () => {
    await copyToClipboard(result.content);
    pushToast({
      title: '회의록을 클립보드에 복사했습니다',
      variant: 'info',
    });
  };

  const handleRegenerate = async () => {
    if (!resolvedRegeneratePromptId.trim()) return;
    setShowRegenerateConfirm(false);
    if (beforeRegenerate && !(await beforeRegenerate())) {
      setActiveTab('note');
      pushToast({ title: '최신 노트를 먼저 저장해주세요', description: '노트의 저장 오류나 충돌을 해결한 뒤 다시 생성할 수 있습니다.', variant: 'error' });
      return;
    }
    const success = await regenerateResult(resolvedRegeneratePromptId.trim());
    if (!success) return;

    setShowRegenerate(false);
    setRegeneratePromptId('');
    pushToast({
      title: 'AI가 회의록을 재생성하고 있습니다',
      description: '완료되면 자동으로 결과가 업데이트됩니다.',
      variant: 'info',
    });
  };

  const handleRegenerateClick = () => {
    if (!resolvedRegeneratePromptId.trim()) return;
    setShowRegenerateConfirm(true);
  };

  const openRegeneratePanel = () => {
    setShowRegenerate(true);
  };

  const handleExportPDF = async () => {
    setIsExporting('pdf');
    try {
      const success = await exportPDF();
      if (!success) return;
      pushToast({
        title: '다운로드 폴더에 저장되었습니다',
        description: 'PDF 파일이 다운로드되었습니다.',
        variant: 'success',
      });
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportDOCX = async () => {
    setIsExporting('docx');
    try {
      const success = await exportDOCX();
      if (!success) return;
      pushToast({
        title: '다운로드 폴더에 저장되었습니다',
        description: 'DOCX 파일이 다운로드되었습니다.',
        variant: 'success',
      });
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportMD = async () => {
    setIsExporting('md');
    try {
      const success = await exportMD();
      if (!success) return;
      pushToast({
        title: '다운로드 폴더에 저장되었습니다',
        description: 'Markdown 파일이 다운로드되었습니다.',
        variant: 'success',
      });
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="scroll-muted flex h-full flex-col overflow-y-auto">
      <ResultViewerHeader
        result={result}
        isEditing={isEditing}
        isEditingTitle={isEditingTitle}
        editTitle={editTitle}
        isRegenerating={isRegenerating}
        error={error}
        isExporting={isExporting}
        uniqueSpeakers={uniqueSpeakers}
        visibleSpeakers={visibleSpeakers}
        overflowSpeakerCount={overflowSpeakerCount}
        onTitleClick={handleTitleClick}
        onTitleChange={setEditTitle}
        onTitleSave={() => void handleTitleSave()}
        onTitleCancel={() => setIsEditingTitle(false)}
        onStartEdit={handleStartEdit}
        onCancelEdit={() => setIsEditing(false)}
        onSave={handleSave}
        onCopy={() => void handleCopy()}
        onExportPDF={() => void handleExportPDF()}
        onExportDOCX={() => void handleExportDOCX()}
        onExportMD={() => void handleExportMD()}
      />

      <ResultTabNav activeTab={activeTab} onTabChange={setActiveTab} />

      <section
        id="result-tabpanel"
        role="tabpanel"
        aria-labelledby={`result-tab-${activeTab}`}
        tabIndex={0}
        className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-8 sm:px-8 lg:px-10"
      >
        {notePanel && (
          <div hidden={activeTab !== 'note'} className="h-[min(680px,75dvh)] min-h-[420px]">
            <div className="flex h-full flex-col">
              <p className="mb-3 text-xs text-[var(--ink-muted)]">원본 노트를 수정하면 자동 저장됩니다. AI 회의록에 반영하려면 저장 후 재생성해주세요.</p>
              <div className="min-h-0 flex-1">{notePanel}</div>
            </div>
          </div>
        )}
        {!(notePanel && activeTab === 'note') && <ResultViewerTabContent
          activeTab={activeTab}
          isEditing={isEditing}
          result={result}
          promptOptions={promptOptions}
          editContent={editContent}
          visibleTranscripts={visibleTranscripts}
          visibleNoteContent={visibleNoteContent}
          visibleTranscriptError={visibleTranscriptError}
          visibleNoteError={visibleNoteError}
          onEditContentChange={setEditContent}
        />}
      </section>

      {!isEditing && activeTab === 'result' && (
        <footer className="border-t border-[var(--line-soft)] bg-[var(--bg-card)] px-6 py-5">
          <div className="mx-auto w-full max-w-[1200px] sm:px-2 lg:px-4">
          <ResultRegeneratePanel
            isOpen={showRegenerate}
            isRegenerating={isRegenerating}
            promptOptions={promptOptions}
            currentPromptId={result.promptId}
            regeneratePromptId={regeneratePromptId}
            resolvedRegeneratePromptId={resolvedRegeneratePromptId}
            onOpen={openRegeneratePanel}
            onCancel={() => setShowRegenerate(false)}
            onPromptChange={setRegeneratePromptId}
            onRegenerateClick={handleRegenerateClick}
          />
          </div>
        </footer>
      )}
      <ResultRegenerateConfirmDialog
        dialogRef={regenerateDialogRef}
        onClose={() => setShowRegenerateConfirm(false)}
        onCancel={() => setShowRegenerateConfirm(false)}
        onConfirm={handleRegenerate}
      />
    </div>
  );
}
