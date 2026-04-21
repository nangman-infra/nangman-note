export const PROMPT_CONTENT_MAX_LENGTH = 12_000;
export const PROMPT_NAME_MAX_LENGTH = 100;

export const AI_WRITING_TIPS: readonly string[] = [
  '기본 타입(회의록/강의/멘토링)이 문서 구조를 정합니다. 덧붙이는 내용은 강조점과 톤만 조정하세요.',
  '숫자와 날짜는 원문 그대로 유지하도록 지시하면 정확도가 올라갑니다.',
  '항목 순서를 명시하면 결과물이 일관됩니다.',
] as const;

export function getPromptCounterClassName(
  valueLength: number,
  maxLength: number,
): string {
  if (valueLength > maxLength * 0.9) return 'text-rose-500';
  return 'text-muted';
}

export function getNameValidationLabel({
  nameFilled,
  nameWithinLimit,
}: {
  nameFilled: boolean;
  nameWithinLimit: boolean;
}): string {
  if (!nameFilled) return '프롬프트 이름을 입력해주세요.';
  if (!nameWithinLimit) {
    return `이름은 ${PROMPT_NAME_MAX_LENGTH}자 이내여야 합니다.`;
  }
  return '프롬프트 이름이 입력되었습니다.';
}

export function getContentValidationLabel({
  contentFilled,
  contentWithinLimit,
  trimmedContentLength,
}: {
  contentFilled: boolean;
  contentWithinLimit: boolean;
  trimmedContentLength: number;
}): string {
  if (!contentFilled) return '강조 지시 내용을 입력해주세요.';
  if (!contentWithinLimit) {
    return `내용은 ${PROMPT_CONTENT_MAX_LENGTH.toLocaleString()}자 이내여야 합니다.`;
  }
  return `강조 지시가 ${trimmedContentLength.toLocaleString()}자 작성되었습니다.`;
}

export function getPromptSubmitLabel(
  isLoading: boolean,
  mode: 'create' | 'edit',
): string {
  if (isLoading) return '저장 중...';
  if (mode === 'create') return '생성';
  return '저장';
}
