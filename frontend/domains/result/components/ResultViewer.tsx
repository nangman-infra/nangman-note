'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Download, Edit3, FileText, RefreshCw, Save, X } from 'lucide-react';
import { MarkdownWysiwygEditor } from '@/components/editor/MarkdownWysiwygEditor';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { copyToClipboard } from '@/lib/utils/markdown';
import { useResult } from '../hooks/useResult';
import {
  resultTabDataApi,
  type ResultTabTranscriptSegment,
} from '../api/resultTabDataApi';

interface ResultViewerProps {
  meetingId: string;
  onMeetingUnavailable?: (meetingId: string) => void;
  promptOptions?: Array<{
    id: string;
    name: string;
    isDefault?: boolean;
  }>;
}

function formatSegmentTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

type ResultTab = 'result' | 'transcript' | 'note';

export function ResultViewer({
  meetingId,
  onMeetingUnavailable,
  promptOptions = [],
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
  const [transcripts, setTranscripts] = useState<ResultTabTranscriptSegment[]>(
    [],
  );
  const [noteContent, setNoteContent] = useState<string>('');
  const [tabDataLoaded, setTabDataLoaded] = useState(false);

  // 탭 데이터 로드
  useEffect(() => {
    if (tabDataLoaded || !meetingId) return;

    const loadTabData = async () => {
      try {
        const [segments, note] = await Promise.all([
          resultTabDataApi.listTranscripts(meetingId).catch(() => []),
          resultTabDataApi.getNoteContent(meetingId).catch(() => ''),
        ]);
        setTranscripts(segments);
        setNoteContent(note ?? '');
        setTabDataLoaded(true);
      } catch {
        // 에러 무시 — 탭에서 빈 상태로 표시
      }
    };
    void loadTabData();
  }, [meetingId, tabDataLoaded]);

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

  const resolvedRegeneratePromptId = regeneratePromptId || promptOptions[0]?.id || '';

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
    const success = await regenerateResult(resolvedRegeneratePromptId.trim());
    if (!success) return;

    setShowRegenerate(false);
    setRegeneratePromptId('');
    pushToast({
      title: '새 프롬프트로 회의록을 재생성했습니다',
      variant: 'success',
    });
  };

  const openRegeneratePanel = () => {
    setShowRegenerate(true);
  };

  const handleExportPDF = async () => {
    const success = await exportPDF();
    if (!success) return;

    pushToast({
      title: 'PDF 다운로드를 시작했습니다',
      variant: 'info',
    });
  };

  const handleExportDOCX = async () => {
    const success = await exportDOCX();
    if (!success) return;

    pushToast({
      title: 'DOCX 다운로드를 시작했습니다',
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
                <button type="button" onClick={handleExportDOCX} className="btn-neo">
                  <FileText className="h-4 w-4" />
                  DOCX
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

      {/* 탭 네비게이션 */}
      <div className="border-b border-[var(--line-soft)] px-6">
        <div className="flex gap-1">
          {([
            { key: 'result' as ResultTab, label: '회의록' },
            { key: 'transcript' as ResultTab, label: `전사 원본 (${transcripts.length})` },
            { key: 'note' as ResultTab, label: '메모' },
          ]).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? 'border-b-2 border-brand text-brand'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <section className="scroll-muted flex-1 overflow-y-auto px-6 py-5">
        {/* 회의록 탭 */}
        {activeTab === 'result' && isEditing ? (
          <div className="surface-card h-[min(64vh,760px)] min-h-[360px] overflow-hidden">
            <MarkdownWysiwygEditor
              value={editContent}
              onChange={setEditContent}
              placeholder="마크다운 문법이 입력 위치에서 바로 반영됩니다."
              height="100%"
            />
          </div>
        ) : activeTab === 'result' ? (
          <article className="result-markdown surface-card p-5">
            <ReactMarkdown>{result.content}</ReactMarkdown>
          </article>
        ) : null}

        {/* 전사 원본 탭 */}
        {activeTab === 'transcript' && (
          <div className="surface-card p-5">
            {transcripts.length === 0 ? (
              <p className="text-center text-sm text-muted">아직 수집된 전사 데이터가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {transcripts.map((segment) => (
                  <div key={segment.id} className="flex gap-3 text-sm">
                    <span className="shrink-0 font-mono text-xs text-muted">
                      [{formatSegmentTime(segment.startTime)} ~ {formatSegmentTime(segment.endTime)}]
                    </span>
                    <span>{segment.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 메모 탭 */}
        {activeTab === 'note' && (
          <div className="surface-card p-5">
            {noteContent.trim() ? (
              <article className="result-markdown">
                <ReactMarkdown>{noteContent}</ReactMarkdown>
              </article>
            ) : (
              <p className="text-center text-sm text-muted">작성된 메모가 없습니다.</p>
            )}
          </div>
        )}
      </section>

      {!isEditing && activeTab === 'result' && (
        <footer className="border-t border-[var(--line-soft)] px-6 py-4">
          {!showRegenerate ? (
            <button type="button" onClick={openRegeneratePanel} className="btn-neo">
              <RefreshCw className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              프롬프트 변경 후 재생성
            </button>
          ) : (
            <div className="surface-card flex flex-col gap-3 p-3">
              {promptOptions.length > 0 ? (
                <select
                  value={resolvedRegeneratePromptId}
                  onChange={(e) => setRegeneratePromptId(e.target.value)}
                  className="input-shell"
                >
                  {promptOptions.map((prompt) => (
                    <option key={prompt.id} value={prompt.id}>
                      {prompt.name}
                      {prompt.isDefault ? ' (기본)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={regeneratePromptId}
                  onChange={(e) => setRegeneratePromptId(e.target.value)}
                  placeholder="예: prompt_default_meeting"
                  className="input-shell"
                />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRegenerate(false)}
                  className="btn-neo whitespace-nowrap px-4 py-2 text-sm"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isRegenerating || !resolvedRegeneratePromptId.trim()}
                  className="btn-neo whitespace-nowrap border-transparent bg-brand px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-45"
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
