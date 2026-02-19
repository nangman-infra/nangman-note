'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { useNote } from '../hooks/useNote';

interface NoteEditorProps {
  meetingId: string;
}

export function NoteEditor({ meetingId }: NoteEditorProps) {
  const { noteContent, isSaving, lastSaved, error, setContent } = useNote(meetingId);
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--line-soft)] bg-white/45 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">노트 편집기</p>
            <p className="text-xs text-muted">
              {isSaving ? '자동 저장 중...' : lastSaved ? `마지막 저장: ${lastSaved.toLocaleTimeString()}` : '아직 저장 전'}
            </p>
          </div>

          <div className="inline-flex rounded-full border border-[var(--line-soft)] bg-white p-1 md:hidden">
            <button
              type="button"
              onClick={() => setMobileView('edit')}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                mobileView === 'edit' ? 'bg-brand text-white' : 'text-muted'
              }`}
            >
              편집
            </button>
            <button
              type="button"
              onClick={() => setMobileView('preview')}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                mobileView === 'preview' ? 'bg-brand text-white' : 'text-muted'
              }`}
            >
              미리보기
            </button>
          </div>
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

      <section className="grid min-h-0 flex-1 gap-0 md:grid-cols-2">
        <div
          className={`min-h-0 border-r border-[var(--line-soft)] ${
            mobileView === 'preview' ? 'hidden md:block' : 'block'
          }`}
        >
          <textarea
            value={noteContent}
            onChange={(e) => setContent(e.target.value)}
            placeholder="회의 노트를 자유롭게 작성하세요. Markdown 문법을 사용할 수 있습니다."
            className="h-full w-full resize-none bg-transparent p-4 font-mono text-sm leading-relaxed focus:outline-none"
          />
        </div>

        <div
          className={`min-h-0 overflow-y-auto p-4 ${
            mobileView === 'edit' ? 'hidden md:block' : 'block'
          }`}
        >
          {noteContent.trim().length > 0 ? (
            <article className="result-markdown">
              <ReactMarkdown>{noteContent}</ReactMarkdown>
            </article>
          ) : (
            <p className="text-sm text-muted">
              마크다운 미리보기가 여기에 표시됩니다.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
