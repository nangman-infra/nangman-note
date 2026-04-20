'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { MarkdownWysiwygEditor } from '@/components/editor/MarkdownWysiwygEditor';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { useNote } from '../hooks/useNote';

interface NoteEditorProps {
  meetingId: string;
}

export function NoteEditor({ meetingId }: NoteEditorProps) {
  const { noteContent, isSaving, lastSaved, error, setContent } = useNote(meetingId);

  // 단축키 힌트 (D-2): 첫 사용 시만 표시, localStorage로 dismiss 관리
  const [showShortcutHint, setShowShortcutHint] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('transnote_editor_shortcuts_dismissed');
  });

  const dismissShortcutHint = () => {
    localStorage.setItem('transnote_editor_shortcuts_dismissed', 'true');
    setShowShortcutHint(false);
  };

  return (
    // Outer wrapper: transparent so the parent section's `.editor-dot-grid`
    // background (applied in app/meeting/in-progress/page.tsx per Task 3.2)
    // remains visible around the editorial column. Design risk R1: we do
    // NOT re-apply dot-grid here to avoid moiré against the ToastUI canvas.
    <div className="flex h-full flex-col overflow-hidden">
      {/* Editor fills the full width of its parent column (the meeting page's
          right/editor pane is already width-constrained by the 3-column
          layout). `min-h-0` preserves flex-child height so the ToastUI editor
          can fill the remaining vertical space. */}
      <div className="flex h-full w-full min-h-0 flex-col px-6">
        <header className="bg-transparent py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">노트 편집기</p>
            <p className="text-xs text-muted">
              {isSaving ? '자동 저장 중...' : lastSaved ? `마지막 저장: ${lastSaved.toLocaleTimeString()}` : '아직 저장 전'}
            </p>
          </div>
        </header>

        {error ? (
          <StatusBanner
            variant="warning"
            title="노트 자동 저장 지연"
            message="네트워크 상태를 확인하면 자동으로 재시도됩니다."
            className="mb-3"
          />
        ) : null}

        {/* ToastUI editor host: keep its own background via the
            `.markdown-wysiwyg` rules in globals.css (transparent defaultUI +
            white-ish toolbar). This ensures the dot-grid is visible around
            the editor without bleeding into the writing surface. */}
        <div className="min-h-0 flex-1">
          <MarkdownWysiwygEditor
            value={noteContent}
            onChange={setContent}
            placeholder="회의 노트를 자유롭게 작성하세요. Markdown 문법이 입력 위치에서 바로 반영됩니다."
            height="100%"
          />
        </div>

        {showShortcutHint && (
          <div className="flex items-center justify-between bg-transparent py-2">
            <p className="text-[11px] text-muted">
              Cmd+Z 실행취소 · Cmd+Y 다시실행 · Cmd+B 굵게
            </p>
            <button
              type="button"
              onClick={dismissShortcutHint}
              className="rounded-full p-1 text-muted transition hover:bg-black/5"
              aria-label="단축키 힌트 닫기"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
