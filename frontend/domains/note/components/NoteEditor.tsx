'use client';

import { MarkdownWysiwygEditor } from '@/components/editor/MarkdownWysiwygEditor';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { useNote } from '../hooks/useNote';

interface NoteEditorProps {
  meetingId: string;
}

export function NoteEditor({ meetingId }: NoteEditorProps) {
  const { noteContent, isSaving, lastSaved, error, setContent } = useNote(meetingId);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--line-soft)] bg-white/45 px-4 py-3">
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
          className="m-3"
        />
      ) : null}

      <div className="min-h-0 flex-1">
        <MarkdownWysiwygEditor
          value={noteContent}
          onChange={setContent}
          placeholder="회의 노트를 자유롭게 작성하세요. Markdown 문법이 입력 위치에서 바로 반영됩니다."
          height="100%"
        />
      </div>
    </div>
  );
}
