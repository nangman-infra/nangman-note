import { MarkdownWysiwygEditor } from '@/components/editor/MarkdownWysiwygEditor';
import type { ResultTabTranscriptSegment } from '../api/resultTabDataApi';
import type { MeetingResult } from '../types/result.types';
import { ResultMarkdownPanel } from './ResultMarkdownPanel';
import { ResultNotePanel } from './ResultNotePanel';
import { ResultTranscriptPanel } from './ResultTranscriptPanel';
import type { ResultPromptOption, ResultTab } from './resultViewerTypes';

interface ResultViewerTabContentProps {
  activeTab: ResultTab;
  isEditing: boolean;
  result: MeetingResult;
  promptOptions: ResultPromptOption[];
  editContent: string;
  visibleTranscripts: ResultTabTranscriptSegment[];
  visibleNoteContent: string;
  visibleTranscriptError: string | null;
  visibleNoteError: string | null;
  onEditContentChange: (content: string) => void;
}

export function ResultViewerTabContent({
  activeTab,
  isEditing,
  result,
  promptOptions,
  editContent,
  visibleTranscripts,
  visibleNoteContent,
  visibleTranscriptError,
  visibleNoteError,
  onEditContentChange,
}: ResultViewerTabContentProps) {
  if (activeTab === 'result' && isEditing) {
    return (
      <div className="surface-card h-full min-h-[360px] overflow-hidden">
        <MarkdownWysiwygEditor
          value={editContent}
          onChange={onEditContentChange}
          placeholder="마크다운 문법이 입력 위치에서 바로 반영됩니다."
          height="100%"
        />
      </div>
    );
  }

  if (activeTab === 'result') {
    return <ResultMarkdownPanel result={result} promptOptions={promptOptions} />;
  }

  if (activeTab === 'transcript') {
    return (
      <ResultTranscriptPanel
        error={visibleTranscriptError}
        transcripts={visibleTranscripts}
      />
    );
  }

  if (activeTab === 'note') {
    return <ResultNotePanel error={visibleNoteError} content={visibleNoteContent} />;
  }

  return null;
}
