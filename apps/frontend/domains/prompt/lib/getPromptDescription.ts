import {
  PROMPT_DOCUMENT_TYPE_HELP_TEXT,
  type Prompt,
} from '../types/prompt.types';

type PromptDescriptionSource = Pick<Prompt, 'content' | 'documentType'> & {
  isDefault?: boolean;
};

export function getPromptDescription(
  prompt: PromptDescriptionSource,
): string {
  const typeDescription = PROMPT_DOCUMENT_TYPE_HELP_TEXT[prompt.documentType];

  if (prompt.isDefault) {
    return typeDescription;
  }

  const content = prompt.content.trim();
  return content || typeDescription;
}
