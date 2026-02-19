'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Download, Edit3, RefreshCw, Save, X } from 'lucide-react';
import { MarkdownWysiwygEditor } from '@/components/editor/MarkdownWysiwygEditor';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { copyToClipboard } from '@/lib/utils/markdown';
import { useResult } from '../hooks/useResult';

interface ResultViewerProps {
  meetingId: string;
}

export function ResultViewer({ meetingId }: ResultViewerProps) {
  const { result, isLoading, isRegenerating, error, updateResult, regenerateResult, exportPDF } = useResult(meetingId);
  const { pushToast } = useFeedback();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [regeneratePromptId, setRegeneratePromptId] = useState('');

  useEffect(() => {
    if (!error) return;
    pushToast({
      title: '회의록 작업 중 오류가 발생했습니다',
      description: error,
      variant: 'error',
    });
  }, [error, pushToast]);

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
          <p className="text-sm font-semibold">선택한 회의의 결과가 아직 없습니다</p>
          <p className="mt-1 text-xs text-muted">회의 종료 후 자동 생성된 문서가 여기에 표시됩니다.</p>
        </div>
      </div>
    );
  }

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
    if (!regeneratePromptId.trim()) return;
    const success = await regenerateResult(regeneratePromptId.trim());
    if (!success) return;

    setShowRegenerate(false);
    setRegeneratePromptId('');
    pushToast({
      title: '새 프롬프트로 회의록을 재생성했습니다',
      variant: 'success',
    });
  };

  const handleExportPDF = async () => {
    const success = await exportPDF();
    if (!success) return;

    pushToast({
      title: 'PDF 다운로드를 시작했습니다',
      variant: 'info',
    });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--line-soft)] px-6 py-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted">RESULT</p>
            <h2 className="text-xl font-semibold leading-tight">{result.metadata?.title || '회의록'}</h2>
            <p className="mt-1 text-xs text-muted">생성 시각: {new Date(result.createdAt).toLocaleString()}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isEditing ? (
              <>
                <button type="button" onClick={handleStartEdit} className="btn-neo">
                  <Edit3 className="h-4 w-4" />
                  편집
                </button>
                <button type="button" onClick={handleCopy} className="btn-neo">
                  <Copy className="h-4 w-4" />
                  복사
                </button>
                <button type="button" onClick={handleExportPDF} className="btn-neo">
                  <Download className="h-4 w-4" />
                  PDF
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setIsEditing(false)} className="btn-neo">
                  <X className="h-4 w-4" />
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn-neo border-transparent bg-brand text-white hover:bg-brand-strong hover:text-white"
                >
                  <Save className="h-4 w-4" />
                  저장
                </button>
              </>
            )}
          </div>
        </div>

        {error ? (
          <StatusBanner
            variant="error"
            title="결과 처리 오류"
            message="잠시 후 다시 시도해주세요. 입력하신 내용은 유지됩니다."
            className="mb-3"
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-white px-2.5 py-1 text-muted">단어 수: {result.metadata.transcriptWordCount}</span>
          <span className="rounded-full bg-white px-2.5 py-1 text-muted">노트 길이: {result.metadata.noteLength}</span>
          <span className="rounded-full bg-white px-2.5 py-1 text-muted">
            소요 시간: {Math.round(result.metadata.totalDuration / 60)}분
          </span>
        </div>
      </header>

      <section className="scroll-muted flex-1 overflow-y-auto px-6 py-5">
        {isEditing ? (
          <div className="surface-card h-[min(64vh,760px)] min-h-[360px] overflow-hidden">
            <MarkdownWysiwygEditor
              value={editContent}
              onChange={setEditContent}
              placeholder="마크다운 문법이 입력 위치에서 바로 반영됩니다."
              height="100%"
            />
          </div>
        ) : (
          <article className="result-markdown surface-card p-5">
            <ReactMarkdown>{result.content}</ReactMarkdown>
          </article>
        )}
      </section>

      {!isEditing && (
        <footer className="border-t border-[var(--line-soft)] px-6 py-4">
          {!showRegenerate ? (
            <button type="button" onClick={() => setShowRegenerate(true)} className="btn-neo">
              <RefreshCw className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              프롬프트 변경 후 재생성
            </button>
          ) : (
            <div className="surface-card flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
              <input
                type="text"
                value={regeneratePromptId}
                onChange={(e) => setRegeneratePromptId(e.target.value)}
                placeholder="예: prompt_default_meeting"
                className="input-shell"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRegenerate(false)}
                  className="btn-neo px-3 py-2 text-xs"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isRegenerating || !regeneratePromptId.trim()}
                  className="btn-neo border-transparent bg-brand px-3 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isRegenerating ? '재생성 중...' : '재생성 실행'}
                </button>
              </div>
            </div>
          )}
        </footer>
      )}
    </div>
  );
}
