'use client';

import { useNote } from '../hooks/useNote';

interface NoteEditorProps {
  meetingId: string;
}

export function NoteEditor({ meetingId }: NoteEditorProps) {
  const { noteContent, isSaving, lastSaved, setContent } = useNote(meetingId);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">노트</span>
          {isSaving && (
            <span className="text-xs text-blue-600">저장 중...</span>
          )}
          {lastSaved && !isSaving && (
            <span className="text-xs text-gray-500">
              마지막 저장: {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <textarea
        value={noteContent}
        onChange={(e) => setContent(e.target.value)}
        placeholder="회의 내용을 자유롭게 작성하세요... (Markdown 지원)"
        className="flex-1 p-4 resize-none focus:outline-none font-mono text-sm"
      />
    </div>
  );
}
