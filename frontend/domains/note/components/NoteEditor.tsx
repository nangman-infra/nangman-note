'use client';

import { Download, Save } from 'lucide-react';
import { MarkdownWysiwygEditor } from '@/components/editor/MarkdownWysiwygEditor';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { downloadAsMarkdown } from '@/lib/utils/markdown';
import { useNote } from '../hooks/useNote';
import { NOTE_MAX_LENGTH } from '../types/note.types';

interface NoteEditorProps {
  meetingId: string;
}

export function NoteEditor({ meetingId }: NoteEditorProps) {
  const {
    activeMeetingId, noteContent, isDirty, isSaving, isLoading, hasLoaded,
    lastSaved, error, errorKind, backupError, restoredFromBackup, isOnline,
    conflict, recoveryDrafts, setContent, saveNow, reload, resolveConflict, restoreDraft,
  } = useNote(meetingId);
  const isCurrent = activeMeetingId === meetingId;
  const isOverLength = noteContent.length > NOTE_MAX_LENGTH;
  const canEdit = isCurrent && (hasLoaded || restoredFromBackup);
  const canSave = isCurrent && hasLoaded && isDirty && !isSaving && !isLoading &&
    !isOverLength && isOnline && errorKind !== 'conflict' && errorKind !== 'load';
  const getStatus = () => {
    if (!isCurrent || (isLoading && !hasLoaded)) return '노트 불러오는 중...';
    if (errorKind === 'conflict') return '충돌 확인 필요';
    if (errorKind === 'load') return '노트 불러오기 실패';
    if (isOverLength) return '길이 초과 · 저장 안 됨';
    if (isSaving) return '자동 저장 중...';
    if (isDirty && !isOnline) return '오프라인 · 저장 대기';
    if (error) return '저장 실패';
    if (isDirty) return '저장 대기 중';
    return lastSaved ? `마지막 저장: ${lastSaved.toLocaleTimeString()}` : '변경 사항 없음';
  };
  let dotClass = 'bg-[var(--ink-faint)]';
  if (lastSaved) dotClass = 'bg-success';
  if (error || isDirty) dotClass = 'bg-[var(--accent)]';
  const errorTitles = { load: '노트를 불러오지 못했습니다', conflict: '동시 편집 충돌', save: '노트를 저장하지 못했습니다' };

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          if (canSave) void saveNow();
        }
      }}
    >
      <div className="flex h-full min-h-0 w-full flex-col px-3 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div>
            <p className="text-sm text-[var(--ink-subtle)]">노트</p>
            <p role="status" aria-live="polite" className="mt-1 flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
              {getStatus()}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-icon" aria-label="현재 노트 Markdown 다운로드"
              disabled={!canEdit} onClick={() => downloadAsMarkdown(noteContent, `note-${meetingId}`)}>
              <Download className="h-4 w-4" />
            </button>
            <button type="button" className="btn-secondary inline-flex items-center gap-1.5 text-xs"
              disabled={!canSave} onClick={() => void saveNow()}>
              <Save className="h-3.5 w-3.5" /> 지금 저장
            </button>
          </div>
        </header>

        <div className="scroll-muted max-h-[45%] shrink-0 overflow-y-auto">
          {backupError && isDirty && (
            <StatusBanner variant="error" title="브라우저 초안을 보관하지 못했습니다"
              message="브라우저 저장 공간이 부족하거나 차단되어 있습니다. 저장 완료 전에는 현재 노트를 Markdown으로 다운로드해주세요." className="mb-3" />
          )}
          {restoredFromBackup && !conflict && (
            <StatusBanner variant="info" title="저장하지 못한 초안을 복원했습니다"
              message="서버 버전을 확인한 뒤 연결되면 자동 저장합니다. 빈 내용으로 지운 수정도 복원됩니다." className="mb-3" />
          )}
          {isOverLength && (
            <StatusBanner variant="warning" title="노트 길이 제한 초과"
              message="100,000자를 초과하면 노트 전체가 서버에 저장되지 않습니다. 다운로드한 뒤 내용을 나누어주세요." className="mb-3" />
          )}
          {error && !isOverLength && (
            <div className="mb-3">
              <StatusBanner variant="warning"
                title={errorTitles[errorKind ?? 'save']}
                message={error} />
              {(errorKind === 'load' || (errorKind === 'conflict' && !conflict)) && (
                <button type="button" className="btn-secondary mt-2 text-xs" disabled={isLoading} onClick={() => void reload()}>
                  다시 불러오기
                </button>
              )}
            </div>
          )}
          {conflict && (
            <div className="surface-card mb-3 space-y-2 p-3">
              <details>
                <summary className="cursor-pointer text-sm">서버에 저장된 노트 확인 (버전 {conflict.revision})</summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs">{conflict.content || '(빈 노트)'}</pre>
              </details>
              <p className="text-xs text-[var(--ink-muted)]">현재 작성 내용은 아래 편집기에 남아 있습니다. 필요한 부분을 합친 뒤 선택하세요.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary text-xs" onClick={() => { resolveConflict('local'); void saveNow(); }}>현재 내용으로 저장</button>
                <button type="button" className="btn-secondary text-xs" onClick={() => resolveConflict('server')}>서버 내용으로 교체</button>
              </div>
            </div>
          )}
          {recoveryDrafts.length > 0 && (
            <details className="mb-3 text-xs">
              <summary className="cursor-pointer">다른 복구 가능한 초안 {recoveryDrafts.length}개</summary>
              {recoveryDrafts.map((draft) => (
                <div key={draft.key} className="mt-2 flex flex-wrap items-center gap-2">
                  <span>{draft.savedAt ? new Date(draft.savedAt).toLocaleString() : '이전 초안'} · {draft.content.length.toLocaleString()}자</span>
                  <button type="button" className="btn-secondary text-xs" disabled={isDirty || isSaving || isLoading}
                    onClick={() => restoreDraft(draft.key)}>복원</button>
                  <button type="button" className="btn-secondary text-xs"
                    onClick={() => downloadAsMarkdown(draft.content, `note-draft-${meetingId}`)}>다운로드</button>
                </div>
              ))}
            </details>
          )}
        </div>

        <div className="surface-card min-h-0 flex-1 overflow-hidden !rounded-[16px]" aria-busy={isLoading}>
          {canEdit ? (
            <MarkdownWysiwygEditor key={meetingId} value={noteContent} onChange={setContent}
              placeholder="회의 노트를 자유롭게 작성하세요. Markdown 문법이 입력 위치에서 바로 반영됩니다." height="100%" />
          ) : (
            <p className="p-6 text-sm text-[var(--ink-muted)]">
              {error ? '기존 노트를 안전하게 불러온 뒤 편집할 수 있습니다.' : '노트를 불러오고 있습니다...'}
            </p>
          )}
        </div>
        <footer className="flex flex-wrap justify-between gap-2 py-2 text-xs text-[var(--ink-muted)]">
          <span>Ctrl/⌘ S 저장 · Ctrl/⌘ Z 실행 취소</span>
          <span>{noteContent.length.toLocaleString()} / {NOTE_MAX_LENGTH.toLocaleString()}자{isDirty && !backupError ? ' · 기기에 초안 보관됨' : ''}</span>
        </footer>
      </div>
    </div>
  );
}
