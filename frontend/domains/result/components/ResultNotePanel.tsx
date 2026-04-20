import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { sanitizeNoteMarkdown } from '@/lib/utils/markdown';

interface ResultNotePanelProps {
  error?: string | null;
  content: string;
}

export function ResultNotePanel({ error, content }: ResultNotePanelProps) {
  if (error) {
    return (
      <div className="surface-card p-5">
        <StatusBanner
          variant="error"
          title="메모를 불러오지 못했습니다"
          message={error}
        />
      </div>
    );
  }

  if (!content.trim()) {
    return (
      <div className="surface-card p-5">
        <p className="text-center text-sm text-muted">작성된 메모가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="surface-card p-5">
      <article className="result-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {sanitizeNoteMarkdown(content)}
        </ReactMarkdown>
      </article>
    </div>
  );
}
