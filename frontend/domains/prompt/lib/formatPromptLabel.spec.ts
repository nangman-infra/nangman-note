import { describe, expect, it } from 'vitest';
import { formatPromptLabel } from './formatPromptLabel';

describe('formatPromptLabel', () => {
  it('omits duplicated document type labels for default prompts', () => {
    expect(
      formatPromptLabel({
        name: '회의',
        documentType: 'meeting',
        isDefault: true,
      }),
    ).toBe('회의 (기본)');
  });

  it('omits duplicated document type labels for custom prompts with the same name', () => {
    expect(
      formatPromptLabel({
        name: '멘토링',
        documentType: 'mentoring',
        isDefault: false,
      }),
    ).toBe('멘토링');
  });

  it('keeps the document type when the prompt name is custom', () => {
    expect(
      formatPromptLabel({
        name: '실무 중심 템플릿',
        documentType: 'meeting',
        isDefault: false,
      }),
    ).toBe('실무 중심 템플릿 · 회의');
  });
});
