export type PromptDocumentType = 'meeting' | 'lecture' | 'mentoring';

export const PROMPT_DOCUMENT_TYPE_LABELS: Record<PromptDocumentType, string> = {
  meeting: '회의',
  lecture: '강의',
  mentoring: '멘토링',
};

export const PROMPT_DOCUMENT_TYPE_HELP_TEXT: Record<
  PromptDocumentType,
  string
> = {
  meeting: '안건, 결정사항, 액션 아이템 중심으로 정리합니다.',
  lecture: '핵심 개념, 예시, 복습 포인트 중심으로 정리합니다.',
  mentoring: '실무 팁, 후속 과제, 추가 조사 키워드 중심으로 정리합니다.',
};

export interface Prompt {
  id: string;
  name: string;
  content: string;
  documentType: PromptDocumentType;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromptDto {
  name: string;
  content: string;
  documentType: PromptDocumentType;
}

export interface PromptListResponse {
  default: Prompt[];
  user: Prompt[];
}
