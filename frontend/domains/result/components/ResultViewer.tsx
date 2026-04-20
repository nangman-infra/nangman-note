'use client';

import { useEffect, useRef, useState } from 'react';
import { MarkdownWysiwygEditor } from '@/components/editor/MarkdownWysiwygEditor';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { copyToClipboard } from '@/lib/utils/markdown';
import { useResult } from '../hooks/useResult';
import { useResultTabData } from '../hooks/useResultTabData';
import { ResultMarkdownPanel } from './ResultMarkdownPanel';
import { ResultNotePanel } from './ResultNotePanel';
import { ResultRegenerateConfirmDialog } from './ResultRegenerateConfirmDialog';
import { ResultRegeneratePanel } from './ResultRegeneratePanel';
import { ResultTabNav } from './ResultTabNav';
import { ResultTranscriptPanel } from './ResultTranscriptPanel';
import { ResultViewerHeader } from './ResultViewerHeader';
import type { ResultPromptOption, ResultTab } from './resultViewerTypes';

interface ResultViewerProps {
  meetingId: string;
  onMeetingUnavailable?: (meetingId: string) => void;
  promptOptions?: ResultPromptOption[];
  onTitleUpdate: (meetingId: string, title: string) => Promise<boolean>;
}

export function ResultViewer({
  meetingId,
  onMeetingUnavailable,
  promptOptions = [],
  onTitleUpdate,
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
  const [isExporting, setIsExporting] = useState<'pdf' | 'docx' | null>(null);
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
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="surface-card w-full max-w-xl p-8 text-center">
          <p className="text-sm font-semibold">회의록을 불러오는 중입니다</p>
          <p className="mt-1 text-xs text-muted">AI 정리 결과를 준비하고 있어요.</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="surface-card w-full max-w-xl p-8 text-center">
          <p className="text-sm font-semibold">
            {isPending
              ? '전사 및 회의록을 생성하고 있습니다'
              : isMissingMeeting
                ? '선택한 회의를 찾을 수 없습니다'
              : '선택한 회의의 결과가 아직 없습니다'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {isPending
              ? '음성 전사와 AI 정리가 진행 중입니다. 완료 시 자동으로 표시됩니다.'
              : isMissingMeeting
                ? '목록에서 다른 회의를 선택해주세요.'
              : '회의 종료 후 자동 생성된 문서가 여기에 표시됩니다.'}
          </p>
        </div>
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

  return (
    <div className="flex h-full flex-col">
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
      />

      <ResultTabNav activeTab={activeTab} onTabChange={setActiveTab} />

      <section className="scroll-muted flex-1 overflow-y-auto px-6 py-5">
        {activeTab === 'result' && isEditing ? (
          <div className="surface-card h-full min-h-[360px] overflow-hidden">
            <MarkdownWysiwygEditor
              value={editContent}
              onChange={setEditContent}
              placeholder="마크다운 문법이 입력 위치에서 바로 반영됩니다."
              height="100%"
            />
          </div>
        ) : activeTab === 'result' ? (
          <ResultMarkdownPanel result={result} promptOptions={promptOptions} />
        ) : null}

        {activeTab === 'transcript' && (
          <ResultTranscriptPanel
            error={visibleTranscriptError}
            transcripts={visibleTranscripts}
          />
        )}

        {activeTab === 'note' && (
          <ResultNotePanel error={visibleNoteError} content={visibleNoteContent} />
        )}
      </section>

      {!isEditing && activeTab === 'result' && (
        <footer className="border-t border-[var(--line-soft)] px-6 py-4">
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
