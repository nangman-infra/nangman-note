import { describe, expect, it } from 'vitest';
import { getPromptDescription } from './getPromptDescription';

describe('getPromptDescription', () => {
  it('uses the document type explanation for default prompts instead of prompt content', () => {
    expect(
      getPromptDescription({
        content: '원문 시스템 프롬프트 일부',
        documentType: 'meeting',
        isDefault: true,
      }),
    ).toBe('안건, 결정사항, 액션 아이템 중심으로 정리합니다.');
  });

  it('uses custom content for user prompts', () => {
    expect(
      getPromptDescription({
        content: '리스크와 후속 과제를 강조해줘',
        documentType: 'meeting',
        isDefault: false,
      }),
    ).toBe('리스크와 후속 과제를 강조해줘');
  });

  it('falls back to the document type explanation when user prompt content is blank', () => {
    expect(
      getPromptDescription({
        content: '   ',
        documentType: 'mentoring',
        isDefault: false,
      }),
    ).toBe('실무 팁, 후속 과제, 추가 조사 키워드 중심으로 정리합니다.');
  });
});
