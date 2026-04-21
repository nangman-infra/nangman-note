import type { Dispatch, SetStateAction } from 'react';
import {
  PROMPT_DOCUMENT_TYPE_HELP_TEXT,
  PROMPT_DOCUMENT_TYPE_LABELS,
  type PromptDocumentType,
} from '../types/prompt.types';
import {
  PROMPT_CONTENT_MAX_LENGTH,
  PROMPT_NAME_MAX_LENGTH,
  getPromptCounterClassName,
} from './promptEditorConfig';

interface PromptEditorFieldsProps {
  name: string;
  content: string;
  documentType: PromptDocumentType;
  isLoading: boolean;
  setName: Dispatch<SetStateAction<string>>;
  setContent: Dispatch<SetStateAction<string>>;
  setDocumentType: Dispatch<SetStateAction<PromptDocumentType>>;
}

export function PromptEditorFields({
  name,
  content,
  documentType,
  isLoading,
  setName,
  setContent,
  setDocumentType,
}: PromptEditorFieldsProps) {
  return (
    <div className="space-y-4 lg:col-span-8">
      <div>
        <label
          htmlFor="prompt-name"
          className="label-sm mb-1.5 block text-[var(--ink-muted)]"
        >
          프롬프트 이름
        </label>
        <input
          id="prompt-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={PROMPT_NAME_MAX_LENGTH}
          placeholder="예: 일일 스탠드업"
          className="input-shell w-full"
          disabled={isLoading}
          autoFocus
        />
        <div className="mt-1 flex justify-end">
          <p
            className={`text-[11px] tabular-nums ${getPromptCounterClassName(
              name.length,
              PROMPT_NAME_MAX_LENGTH,
            )}`}
          >
            {name.length.toLocaleString()}/
            {PROMPT_NAME_MAX_LENGTH.toLocaleString()}
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor="prompt-document-type"
          className="label-sm mb-1.5 block text-[var(--ink-muted)]"
        >
          기본 문서 타입
        </label>
        <select
          id="prompt-document-type"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value as PromptDocumentType)}
          className="input-shell w-full"
          disabled={isLoading}
        >
          {Object.entries(PROMPT_DOCUMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-muted">
          {PROMPT_DOCUMENT_TYPE_HELP_TEXT[documentType]}
        </p>
      </div>

      <div>
        <label
          htmlFor="prompt-content"
          className="label-sm mb-1.5 block text-[var(--ink-muted)]"
        >
          추가 강조 지시
        </label>
        <textarea
          id="prompt-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={PROMPT_CONTENT_MAX_LENGTH}
          placeholder="예: 실무 팁과 후속 과제를 더 분명하게 정리해줘"
          rows={12}
          className="input-shell w-full resize-y font-mono text-sm"
          disabled={isLoading}
        />
        <div className="mt-1 flex items-center justify-between">
          <p className="text-[11px] text-muted">
            기본 타입의 구조는 유지하고, 이 프롬프트는 강조점과 표현
            방식만 추가합니다.
          </p>
          <p
            className={`text-[11px] tabular-nums ${getPromptCounterClassName(
              content.length,
              PROMPT_CONTENT_MAX_LENGTH,
            )}`}
          >
            {content.length.toLocaleString()}/
            {PROMPT_CONTENT_MAX_LENGTH.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
