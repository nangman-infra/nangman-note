/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars */
import * as fc from 'fast-check';
import { Repository } from 'typeorm';
import { BedrockService } from '../../../shared/aws/bedrock/bedrock.service';
import { MeetingSearchDocumentService } from '../../meeting/application/meeting-search-document.service';
import { MeetingService } from '../../meeting/application/meeting.service';
import { NoteEntity } from '../../note/domain/note.entity';
import { PromptService } from '../../prompt/application/prompt.service';
import { PromptDocumentType } from '../../prompt/domain/prompt-document-type.enum';
import { PromptEntity } from '../../prompt/domain/prompt.entity';
import { TranscriptSegmentEntity } from '../../transcription/domain/transcript-segment.entity';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { ResultEntity } from '../domain/result.entity';
import { ResultService } from './result.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  StructuredMeetingExtraction,
  StructuredLectureExtraction,
  StructuredMentoringExtraction,
  StructuredNoteExtraction,
} from '../../../shared/aws/bedrock/bedrock.types';

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

// ── Valid extraction arbitraries (for quality/consistency tests) ──

const validMeetingExtractionArb: fc.Arbitrary<StructuredMeetingExtraction> =
  fc.record({
    documentType: fc.constant(PromptDocumentType.MEETING),
    summary: fc.string({ minLength: 10, maxLength: 500 }),
    participants: fc.array(fc.string({ minLength: 1, maxLength: 30 }), {
      minLength: 1,
      maxLength: 5,
    }),
    agendaItems: fc.array(
      fc.record({
        title: fc.string({ minLength: 1, maxLength: 50 }),
        context: fc.option(fc.string({ minLength: 1, maxLength: 200 }), {
          nil: undefined,
        }),
        discussionPoints: fc.array(
          fc.string({ minLength: 1, maxLength: 100 }),
          { minLength: 1, maxLength: 5 },
        ),
        decisions: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
          minLength: 1,
          maxLength: 3,
        }),
        actionItems: fc.array(
          fc.record({
            task: fc.string({ minLength: 1, maxLength: 50 }),
            owner: fc.string({ minLength: 1, maxLength: 20 }),
            deadline: fc.string({ minLength: 1, maxLength: 20 }),
            priority: fc.constantFrom(
              'High' as const,
              'Medium' as const,
              'Low' as const,
            ),
          }),
          { minLength: 1, maxLength: 3 },
        ),
        unresolved: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
          minLength: 1,
          maxLength: 3,
        }),
      }),
      { minLength: 1, maxLength: 3 },
    ),
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

const validLectureExtractionArb: fc.Arbitrary<StructuredLectureExtraction> =
  fc.record({
    documentType: fc.constant(PromptDocumentType.LECTURE),
    summary: fc.string({ minLength: 10, maxLength: 500 }),
    concepts: fc.array(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }),
        context: fc.option(fc.string({ minLength: 1, maxLength: 200 }), {
          nil: undefined,
        }),
        definition: fc.string({ minLength: 1, maxLength: 200 }),
        example: fc.string({ minLength: 1, maxLength: 200 }),
        keyPoints: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
          minLength: 1,
          maxLength: 5,
        }),
      }),
      { minLength: 1, maxLength: 3 },
    ),
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

const validMentoringExtractionArb: fc.Arbitrary<StructuredMentoringExtraction> =
  fc.record({
    documentType: fc.constant(PromptDocumentType.MENTORING),
    summary: fc.string({ minLength: 10, maxLength: 500 }),
    topics: fc.array(
      fc.record({
        title: fc.string({ minLength: 1, maxLength: 50 }),
        context: fc.option(fc.string({ minLength: 1, maxLength: 200 }), {
          nil: undefined,
        }),
        keyPoints: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
          minLength: 1,
          maxLength: 5,
        }),
        practicalTips: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
          minLength: 1,
          maxLength: 5,
        }),
        followUpTasks: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
          minLength: 1,
          maxLength: 5,
        }),
        researchTopics: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
          minLength: 1,
          maxLength: 5,
        }),
        cautions: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
          minLength: 1,
          maxLength: 5,
        }),
      }),
      { minLength: 1, maxLength: 3 },
    ),
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

// ── Property 9: Structurally invalid AI output is rejected ──

describe('Validation Property Tests - Structural (Property 9)', () => {
  const service = createService();
  const validate = (extracted: unknown, documentType: PromptDocumentType) =>
    (service as any).validateStructure(
      extracted as StructuredNoteExtraction,
      documentType,
    );

  // Feature: ai-output-quality, Property 9: 구조적으로 유효하지 않은 AI 출력은 검증에서 거부된다
  /** Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6 */
  it('Property 9: structurally invalid AI output is rejected', () => {
    const docTypeArb = fc.constantFrom(
      PromptDocumentType.MEETING,
      PromptDocumentType.LECTURE,
      PromptDocumentType.MENTORING,
    );

    // Generate structurally invalid extractions using fc.oneof
    const invalidExtractionArb = fc.oneof(
      // Missing documentType
      fc
        .record({
          summary: fc.string({ minLength: 10, maxLength: 100 }),
          agendaItems: fc.constant([]),
        })
        .map((obj) => ({ ...obj, docType: PromptDocumentType.MEETING })),

      // documentType mismatch
      fc
        .record({
          documentType: fc.constant(PromptDocumentType.LECTURE),
          summary: fc.string({ minLength: 10, maxLength: 100 }),
          concepts: fc.constant([]),
        })
        .map((obj) => ({ ...obj, docType: PromptDocumentType.MEETING })),

      // Missing primary array for meeting
      fc
        .record({
          documentType: fc.constant(PromptDocumentType.MEETING),
          summary: fc.string({ minLength: 10, maxLength: 100 }),
        })
        .map((obj) => ({ ...obj, docType: PromptDocumentType.MEETING })),

      // summary is not a string
      fc
        .record({
          documentType: fc.constant(PromptDocumentType.MEETING),
          summary: fc.constant(123),
          agendaItems: fc.constant([]),
        })
        .map((obj) => ({ ...obj, docType: PromptDocumentType.MEETING })),
    );

    fc.assert(
      fc.property(invalidExtractionArb, (invalidObj) => {
        const { docType, ...extracted } = invalidObj as any;
        const result = validate(extracted, docType as PromptDocumentType);
        expect(result.valid).toBe(false);
        expect(result.stage).toBe('structural');
        expect(result.reason).toBeTruthy();
      }),
      { numRuns: 100 },
    );
  });

  /** Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5 */
  it('Property 9: valid extractions pass structural validation', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          validMeetingExtractionArb.map((e) => ({
            extracted: e,
            docType: PromptDocumentType.MEETING,
          })),
          validLectureExtractionArb.map((e) => ({
            extracted: e,
            docType: PromptDocumentType.LECTURE,
          })),
          validMentoringExtractionArb.map((e) => ({
            extracted: e,
            docType: PromptDocumentType.MENTORING,
          })),
        ),
        ({ extracted, docType }) => {
          const result = validate(extracted, docType);
          expect(result.valid).toBe(true);
          expect(result.stage).toBe('structural');
        },
      ),
      { numRuns: 100 },
    );
  });

  /** Validates: Requirements 6.4 */
  it('Property 9: missing primary array for each document type is rejected', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Meeting without agendaItems
          fc.constant({
            extracted: {
              documentType: PromptDocumentType.MEETING,
              summary: 'A valid summary text here',
              participants: ['Alice'],
            },
            docType: PromptDocumentType.MEETING,
          }),
          // Lecture without concepts
          fc.constant({
            extracted: {
              documentType: PromptDocumentType.LECTURE,
              summary: 'A valid summary text here',
            },
            docType: PromptDocumentType.LECTURE,
          }),
          // Mentoring without topics
          fc.constant({
            extracted: {
              documentType: PromptDocumentType.MENTORING,
              summary: 'A valid summary text here',
            },
            docType: PromptDocumentType.MENTORING,
          }),
        ),
        ({ extracted, docType }) => {
          const result = validate(extracted, docType);
          expect(result.valid).toBe(false);
          expect(result.stage).toBe('structural');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 10: Quality-deficient AI output is rejected ──

describe('Validation Property Tests - Quality (Property 10)', () => {
  const service = createService();
  const validateQuality = (
    extracted: StructuredNoteExtraction,
    transcriptText: string,
  ) => (service as any).validateQuality(extracted, transcriptText);

  // Feature: ai-output-quality, Property 10: 품질 기준 미달 AI 출력은 검증에서 거부된다
  /** Validates: Requirements 7.1 */
  it('Property 10a: summary shorter than 10 chars is rejected as quality failure', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 9 }), (shortSummary) => {
        const extracted: StructuredMeetingExtraction = {
          documentType: PromptDocumentType.MEETING,
          summary: shortSummary,
          participants: ['Alice'],
          agendaItems: [
            {
              title: 'Topic',
              discussionPoints: ['point'],
              decisions: ['decision'],
              actionItems: [],
              unresolved: [],
            },
          ],
          overallDecisions: [],
          followUps: [],
          keywords: [],
          uncertainties: [],
        };
        const result = validateQuality(extracted, 'some transcript');
        expect(result.valid).toBe(false);
        expect(result.stage).toBe('quality');
      }),
      { numRuns: 100 },
    );
  });

  /** Validates: Requirements 7.2 */
  it('Property 10b: empty primary array with non-empty transcript is rejected', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 200 }),
        fc
          .string({ minLength: 1, maxLength: 200 })
          .filter((s) => s.trim().length > 0),
        (summary, transcript) => {
          const extracted: StructuredMeetingExtraction = {
            documentType: PromptDocumentType.MEETING,
            summary,
            participants: ['Alice'],
            agendaItems: [],
            overallDecisions: [],
            followUps: [],
            keywords: [],
            uncertainties: [],
          };
          const result = validateQuality(extracted, transcript);
          expect(result.valid).toBe(false);
          expect(result.stage).toBe('quality');
        },
      ),
      { numRuns: 100 },
    );
  });

  /** Validates: Requirements 7.3 */
  it('Property 10c: >50% empty sub-fields is rejected as quality failure', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 10, maxLength: 200 }), (summary) => {
        // Create an extraction where all sub-array fields are empty
        const extracted: StructuredMeetingExtraction = {
          documentType: PromptDocumentType.MEETING,
          summary,
          participants: ['Alice'],
          agendaItems: [
            {
              title: 'Topic',
              discussionPoints: [],
              decisions: [],
              actionItems: [],
              unresolved: [],
            },
          ],
          overallDecisions: [],
          followUps: [],
          keywords: [],
          uncertainties: [],
        };
        const result = validateQuality(extracted, 'some transcript');
        expect(result.valid).toBe(false);
        expect(result.stage).toBe('quality');
      }),
      { numRuns: 100 },
    );
  });

  /** Validates: Requirements 7.1, 7.2, 7.3 */
  it('Property 10d: valid extractions pass quality validation', () => {
    fc.assert(
      fc.property(validMeetingExtractionArb, (extracted) => {
        const result = validateQuality(extracted, 'some transcript content');
        expect(result.valid).toBe(true);
        expect(result.stage).toBe('quality');
      }),
      { numRuns: 100 },
    );
  });
});

// ── Property 11: Language consistency validation ──

describe('Validation Property Tests - Consistency (Property 11)', () => {
  const service = createService();
  const validateConsistency = (
    extracted: StructuredNoteExtraction,
    params: { translateTargetLanguage?: string; languageCode?: string },
  ) => (service as any).validateConsistency(extracted, params);

  // Korean text generator (Hangul syllables)
  const koreanTextArb = fc
    .array(fc.integer({ min: 0xac00, max: 0xd7af }).map(String.fromCharCode), {
      minLength: 20,
      maxLength: 50,
    })
    .map((chars) => chars.join(''));

  // Latin text generator
  const latinTextArb = fc
    .array(
      fc
        .integer({ min: 0x41, max: 0x7a })
        .filter((c) => (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a))
        .map(String.fromCharCode),
      { minLength: 20, maxLength: 50 },
    )
    .map((chars) => chars.join(''));

  const makeExtraction = (summary: string): StructuredMeetingExtraction => ({
    documentType: PromptDocumentType.MEETING,
    summary,
    participants: ['Alice'],
    agendaItems: [
      {
        title: 'Topic',
        discussionPoints: ['point'],
        decisions: ['decision'],
        actionItems: [],
        unresolved: [],
      },
    ],
    overallDecisions: [],
    followUps: [],
    keywords: [],
    uncertainties: [],
  });

  // Feature: ai-output-quality, Property 11: 언어 일관성 검증은 문자 비율로 대상 언어를 확인한다
  /** Validates: Requirements 8.1 */
  it('Property 11a: Korean text with Korean target language passes', () => {
    fc.assert(
      fc.property(koreanTextArb, (koreanText) => {
        const extracted = makeExtraction(koreanText);
        const result = validateConsistency(extracted, {
          translateTargetLanguage: 'Korean',
        });
        expect(result.valid).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /** Validates: Requirements 8.1 */
  it('Property 11b: Latin text with English target language passes', () => {
    fc.assert(
      fc.property(latinTextArb, (latinText) => {
        const extracted = makeExtraction(latinText);
        const result = validateConsistency(extracted, {
          translateTargetLanguage: 'English',
        });
        expect(result.valid).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /** Validates: Requirements 8.4 */
  it('Property 11c: Korean text with English target language fails consistency', () => {
    fc.assert(
      fc.property(koreanTextArb, (koreanText) => {
        const extracted = makeExtraction(koreanText);
        const result = validateConsistency(extracted, {
          translateTargetLanguage: 'English',
        });
        expect(result.valid).toBe(false);
        expect(result.stage).toBe('consistency');
      }),
      { numRuns: 100 },
    );
  });

  /** Validates: Requirements 8.3 */
  it('Property 11d: no target language and no languageCode always passes', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          validMeetingExtractionArb,
          validLectureExtractionArb,
          validMentoringExtractionArb,
        ),
        (extracted) => {
          const result = validateConsistency(extracted, {});
          expect(result.valid).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /** Validates: Requirements 8.2 */
  it('Property 11e: languageCode-based validation works when translateTargetLanguage is absent', () => {
    fc.assert(
      fc.property(koreanTextArb, (koreanText) => {
        const extracted = makeExtraction(koreanText);
        // Korean text with ko-KR languageCode should pass
        const passResult = validateConsistency(extracted, {
          languageCode: 'ko-KR',
        });
        expect(passResult.valid).toBe(true);

        // Korean text with en-US languageCode should fail
        const failResult = validateConsistency(extracted, {
          languageCode: 'en-US',
        });
        expect(failResult.valid).toBe(false);
        expect(failResult.stage).toBe('consistency');
      }),
      { numRuns: 100 },
    );
  });
});

// ── Property 12: Retry behavior ──

describe('Retry Behavior Property Tests (Property 12)', () => {
  // Feature: ai-output-quality, Property 12: 검증 실패 시 최대 2회 재시도 후 fallback으로 전환된다
  /** Validates: Requirements 9.1, 9.2, 9.4 */
  it('Property 12: retries up to 3 times then falls back to legacy', async () => {
    // Create a service with mocked BedrockService that always returns invalid extraction
    const extractMock = jest.fn().mockResolvedValue({
      documentType: PromptDocumentType.MEETING,
      summary: '', // Will fail quality validation (< 10 chars)
      participants: [],
      agendaItems: [],
      overallDecisions: [],
      followUps: [],
      keywords: [],
      uncertainties: [],
    });
    const legacyMock = jest.fn().mockResolvedValue('# Legacy fallback content');

    const service = new ResultService(
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
        extractStructuredNotes: extractMock,
        generateMeetingResult: legacyMock,
      } as unknown as BedrockService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );

    const meeting = {
      id: 'meeting-retry',
      title: 'Retry Test',
      startedAt: new Date(),
      endedAt: new Date(),
    } as unknown as MeetingEntity;

    const prompt = {
      id: 'prompt-1',
      content: 'test prompt',
      documentType: PromptDocumentType.MEETING,
    } as unknown as PromptEntity;

    // Access private method
    const result = await (service as any).generateContentWithAI({
      meeting,
      prompt,
      noteContent: 'some notes',
      transcripts: [],
    });

    // extractStructuredNotes should be called 3 times (original + 2 retries)
    expect(extractMock).toHaveBeenCalledTimes(3);
    // Legacy fallback should be called once
    expect(legacyMock).toHaveBeenCalledTimes(1);
    // Result should be the legacy content
    expect(result).toBe('# Legacy fallback content');
  });

  it('Property 12: returns fallback template when both extraction and legacy fail', async () => {
    const extractMock = jest.fn().mockRejectedValue(new Error('Bedrock error'));
    const legacyMock = jest.fn().mockRejectedValue(new Error('Legacy error'));

    const service = new ResultService(
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
        extractStructuredNotes: extractMock,
        generateMeetingResult: legacyMock,
      } as unknown as BedrockService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );

    const meeting = {
      id: 'meeting-fallback',
      title: 'Fallback Test',
      startedAt: new Date(),
      endedAt: new Date(),
    } as unknown as MeetingEntity;

    const prompt = {
      id: 'prompt-1',
      content: 'test prompt',
      documentType: PromptDocumentType.MEETING,
    } as unknown as PromptEntity;

    const result = await (service as any).generateContentWithAI({
      meeting,
      prompt,
      noteContent: '',
      transcripts: [],
    });

    expect(extractMock).toHaveBeenCalledTimes(3);
    expect(legacyMock).toHaveBeenCalledTimes(1);
    // Should contain fallback template markers
    expect(result).toContain('Fallback Test');
    expect(result).toContain('AI 회의록 생성에 일시적 문제가 발생');
  });
});
