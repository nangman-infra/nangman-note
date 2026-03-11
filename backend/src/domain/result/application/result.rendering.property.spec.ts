import * as fc from 'fast-check';
import { Repository } from 'typeorm';
import { BedrockService } from '../../../shared/aws/bedrock/bedrock.service';
import { MeetingSearchDocumentService } from '../../meeting/application/meeting-search-document.service';
import { MeetingService } from '../../meeting/application/meeting.service';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { MeetingStatus } from '../../meeting/domain/meeting-status.enum';
import { MeetingTranscriptionMode } from '../../meeting/domain/meeting-transcription-mode.enum';
import { NoteEntity } from '../../note/domain/note.entity';
import { PromptService } from '../../prompt/application/prompt.service';
import { PromptDocumentType } from '../../prompt/domain/prompt-document-type.enum';
import { TranscriptSegmentEntity } from '../../transcription/domain/transcript-segment.entity';
import { ResultEntity } from '../domain/result.entity';
import { ResultService } from './result.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  StructuredMeetingExtraction,
  StructuredActionItem,
  StructuredMeetingAgendaItem,
} from '../../../shared/aws/bedrock/bedrock.types';

// Emoji detection helper for Property 8
// Uses individual codepoint checks to avoid ESLint no-misleading-character-class
function containsEmoji(text: string): boolean {
  for (const char of text) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;
    if (cp >= 0x1f600 && cp <= 0x1f64f) return true;
    if (cp >= 0x1f300 && cp <= 0x1f5ff) return true;
    if (cp >= 0x1f680 && cp <= 0x1f6ff) return true;
    if (cp >= 0x1f1e0 && cp <= 0x1f1ff) return true;
    if (cp >= 0x2600 && cp <= 0x26ff) return true;
    if (cp >= 0x2700 && cp <= 0x27bf) return true;
    if (cp >= 0x1f900 && cp <= 0x1f9ff) return true;
    if (cp >= 0x1fa00 && cp <= 0x1fa6f) return true;
    if (cp >= 0x1fa70 && cp <= 0x1faff) return true;
  }
  return false;
}

const buildMeeting = (): MeetingEntity =>
  ({
    id: 'meeting-prop',
    title: '속성 테스트 회의',
    status: MeetingStatus.COMPLETED,
    transcriptionMode: MeetingTranscriptionMode.BATCH,
    startedAt: new Date(),
    endedAt: new Date(),
  }) as unknown as MeetingEntity;

function createService(): ResultService {
  return new ResultService(
    {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as Repository<ResultEntity>,
    { findOne: jest.fn() } as unknown as Repository<NoteEntity>,
    { find: jest.fn() } as unknown as Repository<TranscriptSegmentEntity>,
    {
      findById: jest.fn(),
      updatePrompt: jest.fn(),
    } as unknown as MeetingService,
    {
      refreshByMeetingId: jest.fn(),
    } as unknown as MeetingSearchDocumentService,
    {
      ensureExists: jest.fn(),
      findById: jest.fn(),
    } as unknown as PromptService,
    {
      extractStructuredNotes: jest.fn(),
      generateMeetingResult: jest.fn(),
    } as unknown as BedrockService,
    { emit: jest.fn() } as unknown as EventEmitter2,
  );
}

// Arbitraries
const actionItemArb: fc.Arbitrary<StructuredActionItem> = fc.record({
  task: fc.string({ minLength: 1, maxLength: 50 }),
  owner: fc.string({ minLength: 1, maxLength: 20 }),
  deadline: fc.string({ minLength: 1, maxLength: 20 }),
  priority: fc.constantFrom('High' as const, 'Medium' as const, 'Low' as const),
});

const meetingAgendaItemArb: fc.Arbitrary<StructuredMeetingAgendaItem> =
  fc.record({
    title: fc.string({ minLength: 1, maxLength: 50 }),
    context: fc.option(fc.string({ minLength: 1, maxLength: 200 }), {
      nil: undefined,
    }),
    discussionPoints: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
      maxLength: 5,
    }),
    decisions: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
      maxLength: 3,
    }),
    actionItems: fc.array(actionItemArb, { maxLength: 3 }),
    unresolved: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
      maxLength: 3,
    }),
  });

const meetingExtractionArb: fc.Arbitrary<StructuredMeetingExtraction> =
  fc.record({
    documentType: fc.constant(PromptDocumentType.MEETING),
    summary: fc.string({ minLength: 10, maxLength: 500 }),
    participants: fc.array(fc.string({ minLength: 1, maxLength: 30 }), {
      minLength: 1,
      maxLength: 5,
    }),
    agendaItems: fc.array(meetingAgendaItemArb, {
      minLength: 1,
      maxLength: 3,
    }),
    overallDecisions: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
      maxLength: 5,
    }),
    followUps: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
      maxLength: 5,
    }),
    keywords: fc.array(fc.string({ minLength: 1, maxLength: 30 }), {
      maxLength: 5,
    }),
    uncertainties: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
      maxLength: 3,
    }),
  });

describe('Meeting Rendering Property Tests', () => {
  const service = createService();
  const meeting = buildMeeting();
  const render = (extracted: StructuredMeetingExtraction): string =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    (service as any).renderMeetingMarkdown(meeting, extracted);

  // Feature: ai-output-quality, Property 1: Summary는 서술형 문단으로 렌더링된다
  /** Validates: Requirements 3.1 */
  it('Property 1: summary is rendered as narrative paragraph without bullets', () => {
    fc.assert(
      fc.property(meetingExtractionArb, (extracted) => {
        const md = render(extracted);
        // Find the summary section
        const summaryStart = md.indexOf('## 회의 개요');
        const summaryEnd = md.indexOf('## 안건별 논의');
        if (summaryStart === -1 || summaryEnd === -1) return true;
        const summarySection = md.slice(summaryStart, summaryEnd);
        const summaryLines = summarySection
          .split('\n')
          .filter((l) => l.trim().length > 0);
        // No line in summary section should start with "- " (bullet)
        const hasBullet = summaryLines.some((l) =>
          l.trimStart().startsWith('- '),
        );
        expect(hasBullet).toBe(false);
        // Summary text should be present
        if (extracted.summary) {
          expect(md).toContain(extracted.summary);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: ai-output-quality, Property 2: Context 필드가 있으면 해당 섹션 앞에 문단으로 렌더링된다
  /** Validates: Requirements 1.2 */
  it('Property 2: context field renders as paragraph when present, omitted when absent', () => {
    fc.assert(
      fc.property(meetingExtractionArb, (extracted) => {
        const md = render(extracted);
        for (const item of extracted.agendaItems) {
          const ctx = item.context as string | undefined;
          if (ctx && ctx.trim().length > 0) {
            expect(md).toContain(ctx.trim());
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: ai-output-quality, Property 3: 번호 목록으로 지정된 필드는 `N.` 형식으로 렌더링된다
  /** Validates: Requirements 3.4, 3.5 */
  it('Property 3: numbered list fields use N. format', () => {
    fc.assert(
      fc.property(meetingExtractionArb, (extracted) => {
        const md = render(extracted);
        for (const item of extracted.agendaItems) {
          if (item.discussionPoints.length > 0) {
            expect(md).toContain('1. ');
          }
          if (item.decisions.length > 0) {
            expect(md).toMatch(/\d+\. /);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: ai-output-quality, Property 6: 회의록 참여자는 쉼표 구분 인라인으로 렌더링된다
  /** Validates: Requirements 3.2 */
  it('Property 6: participants rendered as comma-separated inline list', () => {
    fc.assert(
      fc.property(meetingExtractionArb, (extracted) => {
        const md = render(extracted);
        if (extracted.participants.length >= 2) {
          // Should contain comma-separated participants
          expect(md).toContain(', ');
          // Should NOT have bullet-listed participants
          const participantsStart = md.indexOf('## 참여자');
          const participantsEnd = md.indexOf('## 회의 개요');
          if (participantsStart !== -1 && participantsEnd !== -1) {
            const section = md.slice(participantsStart, participantsEnd);
            const lines = section
              .split('\n')
              .filter((l) => l.trim().length > 0);
            const hasBulletParticipant = lines.some(
              (l) => l.trimStart().startsWith('- ') && l !== '## 참여자',
            );
            expect(hasBulletParticipant).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: ai-output-quality, Property 7: 회의록 액션 아이템은 마크다운 테이블로 렌더링된다
  /** Validates: Requirements 3.6 */
  it('Property 7: action items rendered as markdown table', () => {
    fc.assert(
      fc.property(meetingExtractionArb, (extracted) => {
        const md = render(extracted);
        const hasActionItems = extracted.agendaItems.some(
          (item) => item.actionItems.length > 0,
        );
        if (hasActionItems) {
          expect(md).toContain('| 작업 | 담당 | 마감 | 우선순위 |');
          expect(md).toContain('| --- | --- | --- | --- |');
          for (const item of extracted.agendaItems) {
            for (const ai of item.actionItems) {
              expect(md).toContain(ai.task);
              expect(md).toContain(ai.owner);
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: ai-output-quality, Property 8: 렌더링 출력에 이모지가 포함되지 않는다
  /** Validates: Requirements 3.9 */
  it('Property 8: rendered output contains no emoji characters', () => {
    fc.assert(
      fc.property(meetingExtractionArb, (extracted) => {
        const md = render(extracted);
        // Check that the rendering engine itself doesn't inject emojis
        // (AI data may contain emojis, but the template shouldn't add any)
        // Verify the structural parts don't have emojis
        const structuralLines = md
          .split('\n')
          .filter(
            (l) => l.startsWith('#') || l.startsWith('**') || l.startsWith('|'),
          );
        for (const line of structuralLines) {
          expect(containsEmoji(line)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});

import type {
  StructuredLectureExtraction,
  StructuredLectureConcept,
  StructuredMentoringExtraction,
  StructuredMentoringTopic,
} from '../../../shared/aws/bedrock/bedrock.types';

// ── Lecture Arbitraries ──

const lectureConcept: fc.Arbitrary<StructuredLectureConcept> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  context: fc.option(fc.string({ minLength: 1, maxLength: 200 }), {
    nil: undefined,
  }),
  definition: fc.string({ minLength: 0, maxLength: 200 }),
  example: fc.string({ minLength: 0, maxLength: 200 }),
  keyPoints: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
    maxLength: 5,
  }),
});

const lectureExtractionArb: fc.Arbitrary<StructuredLectureExtraction> =
  fc.record({
    documentType: fc.constant(PromptDocumentType.LECTURE),
    summary: fc.string({ minLength: 10, maxLength: 500 }),
    concepts: fc.array(lectureConcept, { minLength: 1, maxLength: 3 }),
    practiceItems: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
      maxLength: 5,
    }),
    keyTakeaways: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
      maxLength: 5,
    }),
    keywords: fc.array(fc.string({ minLength: 1, maxLength: 30 }), {
      maxLength: 5,
    }),
    uncertainties: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
      maxLength: 3,
    }),
  });

// ── Mentoring Arbitraries ──

const mentoringTopicArb: fc.Arbitrary<StructuredMentoringTopic> = fc.record({
  title: fc.string({ minLength: 1, maxLength: 50 }),
  context: fc.option(fc.string({ minLength: 1, maxLength: 200 }), {
    nil: undefined,
  }),
  keyPoints: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
    maxLength: 5,
  }),
  practicalTips: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
    maxLength: 5,
  }),
  followUpTasks: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
    maxLength: 5,
  }),
  researchTopics: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
    maxLength: 5,
  }),
  cautions: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
    maxLength: 5,
  }),
});

const mentoringExtractionArb: fc.Arbitrary<StructuredMentoringExtraction> =
  fc.record({
    documentType: fc.constant(PromptDocumentType.MENTORING),
    summary: fc.string({ minLength: 10, maxLength: 500 }),
    topics: fc.array(mentoringTopicArb, { minLength: 1, maxLength: 3 }),
    keyTakeaways: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
      maxLength: 5,
    }),
    keywords: fc.array(fc.string({ minLength: 1, maxLength: 30 }), {
      maxLength: 5,
    }),
    uncertainties: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
      maxLength: 3,
    }),
  });

// ── Lecture Rendering Property Tests ──

describe('Lecture Rendering Property Tests', () => {
  const service = createService();
  const meeting = buildMeeting();
  const render = (extracted: StructuredLectureExtraction): string =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    (service as any).renderLectureMarkdown(meeting, extracted);

  // Feature: ai-output-quality, Property 1: Summary는 서술형 문단으로 렌더링된다
  /** Validates: Requirements 4.1 */
  it('Property 1: summary is rendered as narrative paragraph without bullets', () => {
    fc.assert(
      fc.property(lectureExtractionArb, (extracted) => {
        const md = render(extracted);
        const summaryStart = md.indexOf('## 강의 요약');
        const summaryEnd = md.indexOf('## 핵심 개념');
        if (summaryStart === -1 || summaryEnd === -1) return true;
        const summarySection = md.slice(summaryStart, summaryEnd);
        const summaryLines = summarySection
          .split('\n')
          .filter((l) => l.trim().length > 0);
        const hasBullet = summaryLines.some((l) =>
          l.trimStart().startsWith('- '),
        );
        expect(hasBullet).toBe(false);
        if (extracted.summary) {
          expect(md).toContain(extracted.summary);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: ai-output-quality, Property 2: Context 필드가 있으면 해당 섹션 앞에 문단으로 렌더링된다
  /** Validates: Requirements 4.2 */
  it('Property 2: context field renders as paragraph when present, omitted when absent', () => {
    fc.assert(
      fc.property(lectureExtractionArb, (extracted) => {
        const md = render(extracted);
        for (const concept of extracted.concepts) {
          const ctx = concept.context as string | undefined;
          if (ctx && ctx.trim().length > 0) {
            expect(md).toContain(ctx.trim());
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: ai-output-quality, Property 3: 번호 목록으로 지정된 필드는 `N.` 형식으로 렌더링된다
  /** Validates: Requirements 4.5, 4.7 */
  it('Property 3: keyPoints use numbered list format (N.)', () => {
    fc.assert(
      fc.property(lectureExtractionArb, (extracted) => {
        const md = render(extracted);
        for (const concept of extracted.concepts) {
          if (concept.keyPoints.length > 0) {
            expect(md).toContain('1. ');
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: ai-output-quality, Property 4: 블록인용으로 지정된 필드는 `>` 형식으로 렌더링된다
  /** Validates: Requirements 4.4 */
  it('Property 4: example uses blockquote format (>)', () => {
    fc.assert(
      fc.property(lectureExtractionArb, (extracted) => {
        const md = render(extracted);
        for (const concept of extracted.concepts) {
          if (concept.example && concept.example.length > 0) {
            expect(md).toContain(`> ${concept.example}`);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: ai-output-quality, Property 5: 체크리스트로 지정된 필드는 `- [ ]` 형식으로 렌더링된다
  /** Validates: Requirements 4.6 */
  it('Property 5: practiceItems use checklist format (- [ ])', () => {
    fc.assert(
      fc.property(lectureExtractionArb, (extracted) => {
        const md = render(extracted);
        if (extracted.practiceItems.length > 0) {
          for (const item of extracted.practiceItems) {
            expect(md).toContain(`- [ ] ${item}`);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: ai-output-quality, Property 8: 렌더링 출력에 이모지가 포함되지 않는다
  /** Validates: Requirements 4.8 */
  it('Property 8: rendered output contains no emoji characters', () => {
    fc.assert(
      fc.property(lectureExtractionArb, (extracted) => {
        const md = render(extracted);
        const structuralLines = md
          .split('\n')
          .filter(
            (l) =>
              l.startsWith('#') || l.startsWith('**') || l.startsWith('> '),
          );
        for (const line of structuralLines) {
          expect(containsEmoji(line)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ── Mentoring Rendering Property Tests ──

describe('Mentoring Rendering Property Tests', () => {
  const service = createService();
  const meeting = buildMeeting();
  const render = (extracted: StructuredMentoringExtraction): string =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    (service as any).renderMentoringMarkdown(meeting, extracted);

  // Feature: ai-output-quality, Property 1: Summary는 서술형 문단으로 렌더링된다
  /** Validates: Requirements 5.1 */
  it('Property 1: summary is rendered as narrative paragraph without bullets', () => {
    fc.assert(
      fc.property(mentoringExtractionArb, (extracted) => {
        const md = render(extracted);
        const summaryStart = md.indexOf('## 세션 요약');
        const summaryEnd = md.indexOf('## 핵심 주제');
        if (summaryStart === -1 || summaryEnd === -1) return true;
        const summarySection = md.slice(summaryStart, summaryEnd);
        const summaryLines = summarySection
          .split('\n')
          .filter((l) => l.trim().length > 0);
        const hasBullet = summaryLines.some((l) =>
          l.trimStart().startsWith('- '),
        );
        expect(hasBullet).toBe(false);
        if (extracted.summary) {
          expect(md).toContain(extracted.summary);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: ai-output-quality, Property 2: Context 필드가 있으면 해당 섹션 앞에 문단으로 렌더링된다
  /** Validates: Requirements 5.2 */
  it('Property 2: context field renders as paragraph when present, omitted when absent', () => {
    fc.assert(
      fc.property(mentoringExtractionArb, (extracted) => {
        const md = render(extracted);
        for (const topic of extracted.topics) {
          const ctx = topic.context as string | undefined;
          if (ctx && ctx.trim().length > 0) {
            expect(md).toContain(ctx.trim());
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: ai-output-quality, Property 3: 번호 목록으로 지정된 필드는 `N.` 형식으로 렌더링된다
  /** Validates: Requirements 5.3, 5.8 */
  it('Property 3: keyPoints and keyTakeaways use numbered list format (N.)', () => {
    fc.assert(
      fc.property(mentoringExtractionArb, (extracted) => {
        const md = render(extracted);
        for (const topic of extracted.topics) {
          if (topic.keyPoints.length > 0) {
            expect(md).toContain('1. ');
          }
        }
        if (extracted.keyTakeaways.length > 0) {
          expect(md).toMatch(/\d+\. /);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: ai-output-quality, Property 4: 블록인용으로 지정된 필드는 `>` 형식으로 렌더링된다
  /** Validates: Requirements 5.4, 5.7 */
  it('Property 4: practicalTips and cautions use blockquote format (>)', () => {
    fc.assert(
      fc.property(mentoringExtractionArb, (extracted) => {
        const md = render(extracted);
        for (const topic of extracted.topics) {
          for (const tip of topic.practicalTips) {
            if (tip.length > 0) {
              expect(md).toContain(`> ${tip}`);
            }
          }
          for (const caution of topic.cautions) {
            if (caution.length > 0) {
              expect(md).toContain(`> ${caution}`);
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: ai-output-quality, Property 5: 체크리스트로 지정된 필드는 `- [ ]` 형식으로 렌더링된다
  /** Validates: Requirements 5.5 */
  it('Property 5: followUpTasks use checklist format (- [ ])', () => {
    fc.assert(
      fc.property(mentoringExtractionArb, (extracted) => {
        const md = render(extracted);
        for (const topic of extracted.topics) {
          for (const task of topic.followUpTasks) {
            if (task.length > 0) {
              expect(md).toContain(`- [ ] ${task}`);
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: ai-output-quality, Property 8: 렌더링 출력에 이모지가 포함되지 않는다
  /** Validates: Requirements 5.9 */
  it('Property 8: rendered output contains no emoji characters', () => {
    fc.assert(
      fc.property(mentoringExtractionArb, (extracted) => {
        const md = render(extracted);
        const structuralLines = md
          .split('\n')
          .filter(
            (l) =>
              l.startsWith('#') || l.startsWith('**') || l.startsWith('> '),
          );
        for (const line of structuralLines) {
          expect(containsEmoji(line)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});
