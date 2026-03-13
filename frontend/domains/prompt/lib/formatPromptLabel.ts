import {
  PROMPT_DOCUMENT_TYPE_LABELS,
  type Prompt,
  type PromptDocumentType,
} from '../types/prompt.types';

type PromptLike = Pick<Prompt, 'name' | 'documentType'> & {
  isDefault?: boolean;
};

interface FormatPromptLabelOptions {
  includeDocumentType?: boolean;
  includeDefaultBadge?: boolean;
}

export function formatPromptLabel(
  prompt: PromptLike,
  options: FormatPromptLabelOptions = {},
): string {
  const {
    includeDocumentType = true,
    includeDefaultBadge = true,
  } = options;

  const typeLabel = PROMPT_DOCUMENT_TYPE_LABELS[prompt.documentType];
  const normalizedName = prompt.name.trim();
  const parts = [normalizedName];

  if (includeDocumentType && normalizedName !== typeLabel) {
    parts.push(typeLabel);
  }

  let label = parts.join(' · ');
  if (includeDefaultBadge && prompt.isDefault) {
    label = `${label} (기본)`;
  }

  return label;
}

export function fallbackPromptLabel(
  documentType: PromptDocumentType,
  isDefault = false,
): string {
  return formatPromptLabel(
    {
      name: PROMPT_DOCUMENT_TYPE_LABELS[documentType],
      documentType,
      isDefault,
    },
    { includeDocumentType: false, includeDefaultBadge: isDefault },
  );
}
