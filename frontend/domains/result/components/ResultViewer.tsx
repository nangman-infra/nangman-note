'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, Copy, Download, Edit3, FileText, Loader2, RefreshCw, Save, Sparkles, X } from 'lucide-react';
import { MarkdownWysiwygEditor } from '@/components/editor/MarkdownWysiwygEditor';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { copyToClipboard, sanitizeNoteMarkdown } from '@/lib/utils/markdown';
import { PROMPT_DOCUMENT_TYPE_LABELS } from '@/lib/constants';
import { meetingApi } from '@/domains/meeting/api/meetingApi';
import { useMeetingStore } from '@/domains/meeting/stores/meetingStore';
import { formatPromptLabel } from '@/domains/prompt/lib/formatPromptLabel';
import { useResult } from '../hooks/useResult';
import { useResultStore } from '../stores/resultStore';
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
    documentType: 'meeting' | 'lecture' | 'mentoring';
    isDefault?: boolean;
  }>;
}

function formatSegmentTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

type ResultTab = 'result' | 'transcript' | 'note';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return '데이터를 불러오지 못했습니다.';
}

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
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [tabDataMeetingId, setTabDataMeetingId] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isExporting, setIsExporting] = useState<'pdf' | 'docx' | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const regenerateDialogRef = useRef<HTMLDialogElement>(null);

  // 탭 데이터 로드
  useEffect(() => {
    if (!meetingId) return;

    let disposed = false;

    const loadTabData = async () => {
      const [segmentsResult, noteResult] = await Promise.allSettled([
        resultTabDataApi.listTranscripts(meetingId),
        resultTabDataApi.getNoteContent(meetingId),
      ]);
      if (disposed) return;

      if (segmentsResult.status === 'fulfilled') {
        setTranscripts(segmentsResult.value);
        setTranscriptError(null);
      } else {
        setTranscripts([]);
        setTranscriptError(toErrorMessage(segmentsResult.reason));
      }

      if (noteResult.status === 'fulfilled') {
        setNoteContent(noteResult.value ?? '');
        setNoteError(null);
      } else {
        setNoteContent('');
        setNoteError(toErrorMessage(noteResult.reason));
      }

      setTabDataMeetingId(meetingId);
    };
    void loadTabData();
    return () => {
      disposed = true;
    };
  }, [meetingId, result?.id, result?.updatedAt, isPending]);

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

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

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
  const selectedRegeneratePrompt = promptOptions.find(
    (prompt) => prompt.id === resolvedRegeneratePromptId,
  );
  const isCurrentTabData = tabDataMeetingId === meetingId;
  const visibleTranscripts = isCurrentTabData ? transcripts : [];
  const visibleNoteContent = isCurrentTabData ? noteContent : '';
  const visibleTranscriptError = isCurrentTabData ? transcriptError : null;
  const visibleNoteError = isCurrentTabData ? noteError : null;

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
  const speakerPalette = [
    'bg-indigo-500',
    'bg-teal-500',
    'bg-amber-500',
    'bg-rose-500',
  ];
  const getSpeakerInitial = (label: string): string => {
    // "spk_0" → "S1", "spk_1" → "S2", else first char upper
    const match = label.match(/^spk[_-]?(\d+)$/i);
    if (match) {
      const idx = Number.parseInt(match[1] ?? '0', 10);
      return `S${idx + 1}`;
    }
    return label.slice(0, 2).toUpperCase();
  };

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
      await meetingApi.update(meetingId, { title: trimmed });
      // Optimistic local update — patch the result store so the title renders immediately
      useResultStore.setState((state) => {
        if (!state.result) return state;
        return {
          result: {
            ...state.result,
            metadata: { ...state.result.metadata, title: trimmed },
          },
        };
      });
      // Also patch the meeting list store so the sidebar title updates immediately
      useMeetingStore.setState((state) => ({
        meetings: state.meetings.map((m) =>
          m.id === meetingId ? { ...m, title: trimmed } : m,
        ),
      }));
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
      <header className="px-6 py-6 sm:px-8 lg:px-12">
        {/* Status badge + date */}
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-full bg-[var(--tertiary-fixed)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--tertiary)]">
            {result.metadata?.totalDuration > 0 ? 'Finished' : 'Draft'}
          </span>
          <span className="text-sm font-medium text-[var(--ink-muted)]">
            {new Date(result.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
            {' · '}
            {Math.round(result.metadata.totalDuration / 60)}분
          </span>
        </div>

        {/* Title — large editorial headline (Manrope, -0.02em) */}
        {isEditingTitle ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => void handleTitleSave()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) void handleTitleSave();
              if (e.key === 'Escape') setIsEditingTitle(false);
            }}
            className="input-shell font-headline text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl"
          />
        ) : (
          <h1
            onClick={handleTitleClick}
            className="font-headline text-3xl font-extrabold leading-tight tracking-tight cursor-pointer hover:text-indigo-700 transition sm:text-4xl lg:text-5xl"
            title="클릭하여 제목 편집"
          >
            {result.metadata?.title || '회의록'}
          </h1>
        )}

        {/* Metadata chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-[var(--secondary-container)] px-2.5 py-1 font-semibold text-[var(--on-secondary-container)]">단어 수: {result.metadata.transcriptWordCount}</span>
          <span className="rounded-full bg-[var(--secondary-container)] px-2.5 py-1 font-semibold text-[var(--on-secondary-container)]">노트 길이: {result.metadata.noteLength}</span>
        </div>

        {/* 참가자 아바타 스택 — transcript의 speakerLabel 기반. 데이터 없으면 숨김 */}
        {uniqueSpeakers.length > 0 ? (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex -space-x-2" aria-label={`참가자 ${uniqueSpeakers.length}명`}>
              {visibleSpeakers.map((label, idx) => (
                <span
                  key={label}
                  title={label}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white ${
                    speakerPalette[idx % speakerPalette.length]
                  }`}
                >
                  {getSpeakerInitial(label)}
                </span>
              ))}
              {overflowSpeakerCount > 0 ? (
                <button
                  type="button"
                  title={uniqueSpeakers.slice(3).join(', ')}
                  aria-label={`추가 참가자 ${overflowSpeakerCount}명`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 ring-2 ring-white hover:bg-slate-300 transition"
                >
                  +{overflowSpeakerCount}
                </button>
              ) : null}
            </div>
            <span className="text-xs font-medium text-[var(--ink-muted)]">
              참가자 {uniqueSpeakers.length}명
            </span>
          </div>
        ) : null}

        {/* Action buttons row */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
            {!isEditing ? (
              <>
                {/* Export dropdown — single btn-primary with PDF/DOCX menu */}
                <div ref={exportMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowExportMenu((v) => !v)}
                    disabled={isExporting !== null}
                    className="btn-primary inline-flex"
                    aria-haspopup="menu"
                    aria-expanded={showExportMenu}
                  >
                    {isExporting !== null ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Export
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {showExportMenu && (
                    <div
                      role="menu"
                      className="absolute left-0 top-full z-20 mt-1 min-w-[180px] rounded-lg bg-white py-1 shadow-lg"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setShowExportMenu(false); void handleExportPDF(); }}
                        disabled={isExporting !== null}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isExporting === 'pdf' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        PDF 내보내기
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setShowExportMenu(false); void handleExportDOCX(); }}
                        disabled={isExporting !== null}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isExporting === 'docx' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        DOCX 내보내기
                      </button>
                    </div>
                  )}
                </div>
                <button type="button" onClick={handleStartEdit} className="btn-secondary inline-flex">
                  <Edit3 className="h-4 w-4" />
                  편집
                </button>
                <button type="button" onClick={handleCopy} className="btn-secondary inline-flex">
                  <Copy className="h-4 w-4" />
                  복사
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary inline-flex">
                  <X className="h-4 w-4" />
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn-primary inline-flex"
                >
                  <Save className="h-4 w-4" />
                  저장
                </button>
              </>
            )}
        </div>

        {isRegenerating ? (
          <StatusBanner
            variant="info"
            title="AI가 회의록을 재생성하고 있습니다"
            message="프롬프트를 변경하여 새로운 회의록을 생성 중입니다. 완료되면 자동으로 업데이트됩니다."
            className="mb-3"
          />
        ) : error ? (
          <StatusBanner
            variant="error"
            title="결과 처리 오류"
            message="잠시 후 다시 시도해주세요. 입력하신 내용은 유지됩니다."
            className="mb-3"
          />
        ) : null}
      </header>

      {/* 탭 네비게이션 — Stitch editorial style */}
      <div className="px-6 sm:px-8 lg:px-12">
        <div className="flex gap-8 border-b border-[var(--outline-variant)]/10">
          {([
            { key: 'result' as ResultTab, label: 'AI Summary' },
            { key: 'transcript' as ResultTab, label: `Full Transcript` },
            { key: 'note' as ResultTab, label: 'Original Notes' },
          ]).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`pb-4 text-sm font-bold tracking-wide transition ${
                activeTab === tab.key
                  ? 'border-b-2 border-brand text-slate-900'
                  : 'border-b-2 border-transparent text-[var(--ink-muted)] hover:text-slate-900'
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
          <div className="surface-card h-full min-h-[360px] overflow-hidden">
            <MarkdownWysiwygEditor
              value={editContent}
              onChange={setEditContent}
              placeholder="마크다운 문법이 입력 위치에서 바로 반영됩니다."
              height="100%"
            />
          </div>
        ) : activeTab === 'result' ? (
          /**
           * AI Summary (Phase 4 — Tasks 4.4 & 4.5)
           *
           * Design spec calls for:
           *  - 좌측(8/12): Executive Summary 카드 (ai-card-accent) + Structured Outline
           *  - 우측(4/12): Action Items 카드 + Core Topics 칩 + AI Confidence / 생성 메타
           *
           * Backend constraint: `MeetingResult` exposes only a single Markdown
           * `content` string plus `metadata` with `title`, `generatedAt`,
           * `totalDuration`, `transcriptWordCount`, `noteLength`. There are NO
           * `action_items`, `core_topics`, or `confidence` fields — and the
           * spec's Preservation rule ("백엔드 변경 금지") forbids adding them.
           * Per the data-mapping rule ("해당 필드가 없으면 UI에서 표시하지 않는다"),
           * we DO NOT render Action Items / Core Topics / Confidence cards.
           *
           * Pragmatic approach:
           *  - Left (lg:col-span-8): AI-labeled markdown article with the
           *    `ai-card-accent` skin (4px `--tertiary` bar on surface-container-
           *    highest). The existing `.result-markdown` typography handles
           *    numbered headings / ordered lists, giving the sectioned outline
           *    feel the design calls for.
           *  - Right (lg:col-span-4): metadata-only side panel — always-shown
           *    "생성 정보" card + optional "사용 프롬프트" card when
           *    `result.promptId` resolves. Below `lg`, these stack under the
           *    article so mobile/tablet users see the same info order.
           */
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--tertiary)]">
                <Sparkles className="h-3.5 w-3.5" />
                AI Summary
              </div>
              <article className="result-markdown ai-card-accent rounded-r-2xl p-6">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.content}</ReactMarkdown>
              </article>
            </div>

            <aside className="flex flex-col gap-4 lg:col-span-4">
              {/* 생성 정보 메타 카드 — 항상 표시 */}
              <div className="rounded-2xl bg-white p-5 shadow-md">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                  생성 정보
                </h3>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-[var(--ink-muted)]">생성 시각</dt>
                    <dd className="text-right text-xs font-medium text-slate-900">
                      {new Date(
                        result.metadata?.generatedAt || result.createdAt,
                      ).toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-[var(--ink-muted)]">전사 단어 수</dt>
                    <dd className="font-mono text-xs font-semibold text-slate-900">
                      {result.metadata.transcriptWordCount.toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-[var(--ink-muted)]">노트 길이</dt>
                    <dd className="font-mono text-xs font-semibold text-slate-900">
                      {result.metadata.noteLength.toLocaleString()}자
                    </dd>
                  </div>
                </dl>
              </div>

              {/* 사용 프롬프트 카드 — promptId 있을 때만 */}
              {result.promptId ? (
                <div className="rounded-2xl bg-[var(--surface-container-low)] p-5">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                    사용 프롬프트
                  </h3>
                  <p className="text-sm font-semibold text-slate-900">
                    {promptOptions.find((p) => p.id === result.promptId)?.name ??
                      result.promptId}
                  </p>
                  {(() => {
                    const p = promptOptions.find((opt) => opt.id === result.promptId);
                    return p ? (
                      <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
                        {PROMPT_DOCUMENT_TYPE_LABELS[p.documentType]}
                      </p>
                    ) : null;
                  })()}
                </div>
              ) : null}
            </aside>
          </div>
        ) : null}

        {/* 전사 원본 탭 */}
        {activeTab === 'transcript' && (
          <div className="surface-card p-5">
            {visibleTranscriptError ? (
              <StatusBanner
                variant="error"
                title="전사 데이터를 불러오지 못했습니다"
                message={visibleTranscriptError}
              />
            ) : visibleTranscripts.length === 0 ? (
              <p className="text-center text-sm text-muted">아직 수집된 전사 데이터가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {visibleTranscripts.map((segment) => (
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
            {visibleNoteError ? (
              <StatusBanner
                variant="error"
                title="메모를 불러오지 못했습니다"
                message={visibleNoteError}
              />
            ) : visibleNoteContent.trim() ? (
              <article className="result-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{sanitizeNoteMarkdown(visibleNoteContent)}</ReactMarkdown>
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
            <button type="button" onClick={openRegeneratePanel} className="btn-secondary inline-flex">
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
                  {[...promptOptions]
                    .sort((a, b) => {
                      // 현재 결과의 프롬프트를 맨 위로
                      const currentId = result?.promptId;
                      if (a.id === currentId && b.id !== currentId) return -1;
                      if (b.id === currentId && a.id !== currentId) return 1;
                      return 0;
                    })
                    .map((prompt) => (
                      <option key={prompt.id} value={prompt.id}>
                        {formatPromptLabel(prompt)}
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
              {selectedRegeneratePrompt ? (
                <p className="text-[11px] text-muted">
                  기본 타입은{' '}
                  {PROMPT_DOCUMENT_TYPE_LABELS[selectedRegeneratePrompt.documentType]}
                  {' '}구조를 사용하고, 사용자 프롬프트는 추가 강조만 반영합니다.
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRegenerate(false)}
                  className="btn-neo inline-flex whitespace-nowrap px-4 py-2 text-sm text-muted hover:text-foreground"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateClick}
                  disabled={isRegenerating || !resolvedRegeneratePromptId.trim()}
                  className="btn-neo inline-flex whitespace-nowrap border-transparent bg-brand px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isRegenerating ? '재생성 중...' : '재생성 실행'}
                </button>
              </div>
            </div>
          )}
        </footer>
      )}
      {/* 재생성 확인 다이얼로그 */}
      <dialog
        ref={regenerateDialogRef}
        onClose={() => setShowRegenerateConfirm(false)}
        className="fixed inset-0 m-auto rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-xl backdrop:bg-black/40"
      >
        <h3 className="text-base font-semibold">재생성 확인</h3>
        <p className="mt-2 text-sm text-muted">
          현재 회의록이 새 결과로 대체됩니다. 계속하시겠습니까?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowRegenerateConfirm(false)}
            className="btn-neo inline-flex px-4 py-2 text-sm text-muted hover:text-foreground"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            className="btn-neo inline-flex border-transparent bg-brand px-4 py-2 text-sm text-white hover:bg-brand-strong hover:text-white"
          >
            계속
          </button>
        </div>
      </dialog>
    </div>
  );
}
