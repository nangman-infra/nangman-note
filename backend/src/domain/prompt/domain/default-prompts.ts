import { PromptEntity } from './prompt.entity';
import { PromptDocumentType } from './prompt-document-type.enum';

const MEETING_PROMPT_CONTENT = [
  '# 기본 방향',
  '이 타입은 회의/협업 기록에 맞춰 결과를 정리합니다.',
  '',
  '- 회의의 안건, 결정사항, 액션 아이템을 가장 중요하게 정리하세요.',
  '- 액션 아이템은 명시적인 요청, 담당 지정, 약속, 합의가 있을 때만 남기세요.',
  '- 설명, 예시, 브레인스토밍, 강의성 발화는 결정사항처럼 쓰지 마세요.',
  '- 담당자나 마감이 불명확하면 추정하지 말고 "미정"으로 남기세요.',
].join('\n');

const LECTURE_PROMPT_CONTENT = [
  '# 기본 방향',
  '이 타입은 강의/스터디/설명형 콘텐츠를 복습하기 좋은 노트로 정리합니다.',
  '',
  '- 핵심 개념, 예시, 기억해야 할 포인트를 중심으로 정리하세요.',
  '- 실제로 언급된 실습, 과제, 복습 포인트만 남기고 업무 태스크처럼 바꾸지 마세요.',
  '- 기술 용어와 설명 맥락을 가능한 한 보존하세요.',
  '- 애매한 내용은 확정적으로 재정의하지 말고 확인 필요로 남기세요.',
].join('\n');

const MENTORING_PROMPT_CONTENT = [
  '# 기본 방향',
  '이 타입은 멘토링/워크숍/실무 코칭 세션을 요약합니다.',
  '',
  '- 실무 팁, 후속 과제, 추가 조사 키워드, 주의사항을 중심으로 정리하세요.',
  '- 설명이나 코칭을 공식 결정사항으로 오인하지 마세요.',
  '- 실제로 명시된 후속 행동만 과제/태스크로 남기세요.',
  '- 강사가 던진 키워드나 탐색 주제는 추가 조사 항목으로 분리하세요.',
].join('\n');

export const DEFAULT_PROMPTS: ReadonlyArray<
  Pick<PromptEntity, 'id' | 'name' | 'content' | 'documentType'>
> = [
  {
    id: 'prompt_default_meeting',
    name: '회의',
    content: MEETING_PROMPT_CONTENT,
    documentType: PromptDocumentType.MEETING,
  },
  {
    id: 'prompt_default_lecture',
    name: '강의',
    content: LECTURE_PROMPT_CONTENT,
    documentType: PromptDocumentType.LECTURE,
  },
  {
    id: 'prompt_default_seminar',
    name: '멘토링',
    content: MENTORING_PROMPT_CONTENT,
    documentType: PromptDocumentType.MENTORING,
  },
];
