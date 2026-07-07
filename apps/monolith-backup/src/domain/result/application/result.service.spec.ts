import { QueryFailedError, Repository } from 'typeorm';
import { BedrockService } from '../../../shared/aws/bedrock/bedrock.service';
import { MeetingSearchDocumentService } from '../../meeting/application/meeting-search-document.service';
import { MeetingService } from '../../meeting/application/meeting.service';
import { MeetingCompletionState } from '../../meeting/domain/meeting-completion-state.enum';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { MeetingStatus } from '../../meeting/domain/meeting-status.enum';
import { MeetingTranscriptionMode } from '../../meeting/domain/meeting-transcription-mode.enum';
import { NoteEntity } from '../../note/domain/note.entity';
import { PromptService } from '../../prompt/application/prompt.service';
import { PromptDocumentType } from '../../prompt/domain/prompt-document-type.enum';
import { PromptEntity } from '../../prompt/domain/prompt.entity';
import { TranscriptSegmentEntity } from '../../transcription/domain/transcript-segment.entity';
import { ResultEntity } from '../domain/result.entity';
import { ResultService } from './result.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ResultService', () => {
  let service: ResultService;
  let resultRepository: jest.Mocked<
    Pick<Repository<ResultEntity>, 'findOne' | 'create' | 'save'>
  >;
  let noteRepository: jest.Mocked<Pick<Repository<NoteEntity>, 'findOne'>>;
  let transcriptRepository: jest.Mocked<
    Pick<Repository<TranscriptSegmentEntity>, 'find'>
  >;
  let meetingService: jest.Mocked<
    Pick<MeetingService, 'findById' | 'updatePrompt' | 'updateProcessingPhase'>
  >;
  let promptService: jest.Mocked<
    Pick<PromptService, 'ensureExists' | 'findById'>
  >;
  let meetingSearchDocumentService: jest.Mocked<
    Pick<MeetingSearchDocumentService, 'refreshByMeetingId'>
  >;
  let bedrockService: jest.Mocked<
    Pick<BedrockService, 'extractStructuredNotes' | 'generateMeetingResult'>
  >;
  let eventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit'>>;

  const buildMeeting = (
    overrides: Partial<MeetingEntity> = {},
  ): MeetingEntity =>
    ({
      id: 'meeting-1',
      title: '테스트 회의',
      promptId: 'prompt_default_meeting',
      status: MeetingStatus.COMPLETED,
      transcriptionMode: MeetingTranscriptionMode.BATCH,
      startedAt: new Date('2026-03-01T00:00:00.000Z'),
      endedAt: new Date('2026-03-01T00:10:00.000Z'),
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:10:00.000Z'),
      ...overrides,
    }) as unknown as MeetingEntity;

  const buildPrompt = (overrides: Partial<PromptEntity> = {}): PromptEntity =>
    ({
      id: 'prompt_default_meeting',
      name: '기본 프롬프트',
      content: '회의 요약 생성',
      documentType: PromptDocumentType.MEETING,
      isDefault: true,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      meetings: [],
      results: [],
      ...overrides,
    }) as unknown as PromptEntity;

  const buildResult = (overrides: Partial<ResultEntity> = {}): ResultEntity =>
    ({
      id: 'result-1',
      meetingId: 'meeting-1',
      promptId: 'prompt_default_meeting',
      content: '# 결과',
      metadata: {
        title: '테스트 회의',
        generatedAt: '2026-03-01T00:10:00.000Z',
        totalDuration: 600,
        transcriptWordCount: 4,
        noteLength: 6,
      },
      createdAt: new Date('2026-03-01T00:10:00.000Z'),
      updatedAt: new Date('2026-03-01T00:10:00.000Z'),
      ...overrides,
    }) as unknown as ResultEntity;

  beforeEach(() => {
    resultRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    noteRepository = {
      findOne: jest.fn(),
    };
    transcriptRepository = {
      find: jest.fn(),
    };
    meetingService = {
      findById: jest.fn(),
      updatePrompt: jest.fn(),
      updateProcessingPhase: jest.fn(),
    };
    promptService = {
      ensureExists: jest.fn(),
      findById: jest.fn(),
    };
    meetingSearchDocumentService = {
      refreshByMeetingId: jest.fn(),
    };
    bedrockService = {
      extractStructuredNotes: jest.fn(),
      generateMeetingResult: jest.fn(),
    };
    eventEmitter = {
      emit: jest.fn(),
    };

    service = new ResultService(
      resultRepository as unknown as Repository<ResultEntity>,
      noteRepository as unknown as Repository<NoteEntity>,
      transcriptRepository as unknown as Repository<TranscriptSegmentEntity>,
      meetingService as unknown as MeetingService,
      meetingSearchDocumentService as unknown as MeetingSearchDocumentService,
      promptService as unknown as PromptService,
      bedrockService as unknown as BedrockService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('findByMeetingId', () => {
    it('returns existing result when already generated', async () => {
      const existing = buildResult();
      meetingService.findById.mockResolvedValue(buildMeeting());
      resultRepository.findOne.mockResolvedValue(existing);

      const result = await service.findByMeetingId('meeting-1');

      expect(result).toEqual(existing);
      expect(resultRepository.save.mock.calls).toHaveLength(0);
    });

    it('generates and saves result when missing', async () => {
      meetingService.findById.mockResolvedValue(buildMeeting());
      resultRepository.findOne.mockResolvedValue(null);
      promptService.findById.mockResolvedValue(buildPrompt());
      noteRepository.findOne.mockResolvedValue({
        id: 'note-1',
        meetingId: 'meeting-1',
        content: '핵심 내용',
      } as NoteEntity);
      transcriptRepository.find.mockResolvedValue([
        {
          id: 'segment-1',
          meetingId: 'meeting-1',
          startTime: 0,
          endTime: 3.1,
          text: '안건 공유',
          confidence: 0.95,
        } as TranscriptSegmentEntity,
      ]);
      bedrockService.extractStructuredNotes.mockResolvedValue({
        documentType: PromptDocumentType.MEETING,
        summary: '안건 공유와 후속 작업을 정리했다.',
        participants: ['택준'],
        agendaItems: [
          {
            title: '안건 공유',
            discussionPoints: ['진행 현황을 확인했다'],
            decisions: ['다음 주까지 정리한다'],
            actionItems: [
              {
                task: '진행 현황 정리',
                owner: '택준',
                deadline: '다음 주',
                priority: 'Medium',
              },
            ],
            unresolved: [],
          },
        ],
        overallDecisions: ['다음 주까지 정리한다'],
        followUps: ['후속 점검'],
        keywords: ['안건', '정리'],
        uncertainties: [],
      });
      resultRepository.create.mockImplementation(
        (entity) => entity as ResultEntity,
      );
      resultRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity as ResultEntity),
      );

      const result = await service.findByMeetingId('meeting-1');

      const createArg = resultRepository.create.mock.calls[0]?.[0] as
        | Partial<ResultEntity>
        | undefined;
      expect(createArg).toBeDefined();
      if (!createArg) {
        throw new Error('Expected resultRepository.create to be called');
      }
      expect(createArg.meetingId).toBe('meeting-1');
      expect(createArg.promptId).toBe('prompt_default_meeting');
      expect(createArg.content).toContain('# 테스트 회의');
      expect(createArg.content).toContain('## 회의 개요');
      expect(createArg.content).toContain('## 안건별 논의');
      expect(createArg.content).toContain(
        '| 진행 현황 정리 | 택준 | 다음 주 | Medium |',
      );
      expect(createArg.metadata?.totalDuration).toBe(600);
      expect(createArg.metadata?.transcriptWordCount).toBe(2);
      expect(createArg.metadata?.noteLength).toBe(5);
      expect(
        meetingSearchDocumentService.refreshByMeetingId,
      ).toHaveBeenCalledWith('meeting-1');
      expect(meetingService.updateProcessingPhase).toHaveBeenCalledWith(
        'meeting-1',
        null,
        undefined,
        expect.objectContaining({
          status: MeetingStatus.COMPLETED,
          completionState: MeetingCompletionState.SUCCEEDED,
          needsAttention: false,
        }),
      );
      expect(result.content).toContain('안건 공유와 후속 작업을 정리했다.');
    });

    it('marks note-only results as partial completion', async () => {
      meetingService.findById.mockResolvedValue(buildMeeting());
      resultRepository.findOne.mockResolvedValue(null);
      promptService.findById.mockResolvedValue(buildPrompt());
      noteRepository.findOne.mockResolvedValue({
        id: 'note-1',
        meetingId: 'meeting-1',
        content: '메모만 있습니다',
      } as NoteEntity);
      transcriptRepository.find.mockResolvedValue([]);
      bedrockService.extractStructuredNotes.mockResolvedValue({
        documentType: PromptDocumentType.MEETING,
        summary: '메모 기반 요약',
        participants: [],
        agendaItems: [],
        overallDecisions: [],
        followUps: [],
        keywords: [],
        uncertainties: [],
      });
      resultRepository.create.mockImplementation(
        (entity) => entity as ResultEntity,
      );
      resultRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity as ResultEntity),
      );

      await service.findByMeetingId('meeting-1');

      expect(meetingService.updateProcessingPhase).toHaveBeenCalledWith(
        'meeting-1',
        null,
        undefined,
        expect.objectContaining({
          status: MeetingStatus.COMPLETED,
          completionState: MeetingCompletionState.PARTIAL,
          needsAttention: false,
        }),
      );
    });

    it('marks empty results as attention required', async () => {
      meetingService.findById.mockResolvedValue(buildMeeting());
      resultRepository.findOne.mockResolvedValue(null);
      promptService.findById.mockResolvedValue(buildPrompt());
      noteRepository.findOne.mockResolvedValue(null);
      transcriptRepository.find.mockResolvedValue([]);
      resultRepository.create.mockImplementation(
        (entity) => entity as ResultEntity,
      );
      resultRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity as ResultEntity),
      );

      const result = await service.findByMeetingId('meeting-1');

      expect(result.content).toContain(
        '작성된 노트와 수집된 전사 데이터가 없습니다',
      );
      expect(meetingService.updateProcessingPhase).toHaveBeenCalledWith(
        'meeting-1',
        null,
        undefined,
        expect.objectContaining({
          status: MeetingStatus.COMPLETED,
          completionState: MeetingCompletionState.ATTENTION_REQUIRED,
          needsAttention: true,
        }),
      );
    });

    it('preserves short utterances when speaker changes in AI transcript input', async () => {
      meetingService.findById.mockResolvedValue(buildMeeting());
      resultRepository.findOne.mockResolvedValue(null);
      promptService.findById.mockResolvedValue(buildPrompt());
      noteRepository.findOne.mockResolvedValue(null);
      transcriptRepository.find.mockResolvedValue([
        {
          id: 'segment-1',
          meetingId: 'meeting-1',
          startTime: 0,
          endTime: 1,
          text: '결정은 다음주에 진행합니다',
          confidence: 0.95,
          speakerLabel: 'spk_0',
        } as TranscriptSegmentEntity,
        {
          id: 'segment-2',
          meetingId: 'meeting-1',
          startTime: 1.1,
          endTime: 1.2,
          text: '확인',
          confidence: 0.95,
          speakerLabel: 'spk_1',
        } as TranscriptSegmentEntity,
        {
          id: 'segment-3',
          meetingId: 'meeting-1',
          startTime: 1.3,
          endTime: 1.4,
          text: '확인',
          confidence: 0.95,
          speakerLabel: 'spk_0',
        } as TranscriptSegmentEntity,
      ]);
      bedrockService.extractStructuredNotes.mockResolvedValue({
        documentType: PromptDocumentType.MEETING,
        summary: '요약',
        participants: [],
        agendaItems: [],
        overallDecisions: [],
        followUps: [],
        keywords: [],
        uncertainties: [],
      });
      resultRepository.create.mockImplementation(
        (entity) => entity as ResultEntity,
      );
      resultRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity as ResultEntity),
      );

      await service.findByMeetingId('meeting-1');

      const call = bedrockService.extractStructuredNotes.mock.calls[0]?.[0] as
        | { transcriptText: string }
        | undefined;
      expect(call).toBeDefined();
      if (!call) {
        throw new Error('Expected BedrockService.extractStructuredNotes call');
      }

      const lines = call.transcriptText.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toContain('[화자: spk_0] 결정은 다음주에 진행합니다');
      expect(lines[1]).toContain('[화자: spk_1] 확인');
      expect(lines[2]).toContain('[화자: spk_0] 확인');
    });

    it('returns existing result when save fails with unique constraint', async () => {
      const existing = buildResult({ content: '# 기존 결과' });
      meetingService.findById.mockResolvedValue(buildMeeting());
      resultRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);
      promptService.findById.mockResolvedValue(buildPrompt());
      noteRepository.findOne.mockResolvedValue({
        id: 'note-1',
        meetingId: 'meeting-1',
        content: '핵심 내용',
      } as NoteEntity);
      transcriptRepository.find.mockResolvedValue([]);
      bedrockService.extractStructuredNotes.mockResolvedValue({
        documentType: PromptDocumentType.MEETING,
        summary: '요약',
        participants: [],
        agendaItems: [],
        overallDecisions: [],
        followUps: [],
        keywords: [],
        uncertainties: [],
      });
      resultRepository.create.mockImplementation(
        (entity) => entity as ResultEntity,
      );
      resultRepository.save.mockRejectedValue(
        new QueryFailedError('INSERT INTO result ...', [], {
          code: '23505',
          detail: 'duplicate key value violates unique constraint',
        } as unknown as Error),
      );

      const result = await service.findByMeetingId('meeting-1');

      expect(result).toEqual(existing);
      expect(
        meetingSearchDocumentService.refreshByMeetingId,
      ).toHaveBeenCalledWith('meeting-1');
    });

    it('deduplicates concurrent generation requests for the same meeting', async () => {
      meetingService.findById.mockResolvedValue(buildMeeting());
      resultRepository.findOne.mockResolvedValue(null);
      promptService.findById.mockResolvedValue(buildPrompt());
      noteRepository.findOne.mockResolvedValue({
        id: 'note-1',
        meetingId: 'meeting-1',
        content: '핵심 내용',
      } as NoteEntity);
      transcriptRepository.find.mockResolvedValue([
        {
          id: 'segment-1',
          meetingId: 'meeting-1',
          startTime: 0,
          endTime: 3.1,
          text: '안건 공유',
          confidence: 0.95,
        } as TranscriptSegmentEntity,
      ]);
      bedrockService.extractStructuredNotes.mockImplementation(
        async () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                documentType: PromptDocumentType.MEETING,
                summary: '안건 공유와 후속 작업을 정리했다.',
                participants: ['택준'],
                agendaItems: [],
                overallDecisions: [],
                followUps: [],
                keywords: [],
                uncertainties: [],
              });
            }, 0);
          }),
      );
      resultRepository.create.mockImplementation(
        (entity) => entity as ResultEntity,
      );
      resultRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity as ResultEntity),
      );

      const first = service.findByMeetingId('meeting-1');
      const second = service.findByMeetingId('meeting-1');

      const [firstResult, secondResult] = await Promise.all([first, second]);

      expect(firstResult).toEqual(secondResult);
      expect(resultRepository.save).toHaveBeenCalledTimes(1);
      expect(
        meetingSearchDocumentService.refreshByMeetingId,
      ).toHaveBeenCalledTimes(1);
    });

    it('rethrows save failure when it is not a unique constraint error', async () => {
      meetingService.findById.mockResolvedValue(buildMeeting());
      resultRepository.findOne.mockResolvedValue(null);
      promptService.findById.mockResolvedValue(buildPrompt());
      noteRepository.findOne.mockResolvedValue(null);
      transcriptRepository.find.mockResolvedValue([]);
      bedrockService.extractStructuredNotes.mockRejectedValue(
        new Error('structured extraction failed'),
      );
      bedrockService.generateMeetingResult.mockResolvedValue('# 폴백 결과');
      resultRepository.create.mockImplementation(
        (entity) => entity as ResultEntity,
      );
      resultRepository.save.mockRejectedValue(new Error('database timeout'));

      await expect(service.findByMeetingId('meeting-1')).rejects.toThrow(
        'database timeout',
      );
    });
  });

  describe('update', () => {
    it('updates content and noteLength in metadata', async () => {
      const existing = buildResult({
        metadata: {
          title: '기존 제목',
          generatedAt: '2026-03-01T00:00:00.000Z',
          totalDuration: 120,
          transcriptWordCount: 20,
          noteLength: 1,
        },
      });
      meetingService.findById.mockResolvedValue(buildMeeting());
      resultRepository.findOne.mockResolvedValue(existing);
      resultRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity as ResultEntity),
      );

      const updated = await service.update('meeting-1', {
        content: '업데이트된 결과 문서',
      });

      expect(updated.content).toBe('업데이트된 결과 문서');
      expect(updated.metadata.noteLength).toBe('업데이트된 결과 문서'.length);
      expect(updated.metadata.totalDuration).toBe(120);
      expect(
        meetingSearchDocumentService.refreshByMeetingId,
      ).toHaveBeenCalledWith('meeting-1');
    });
  });

  describe('regenerate', () => {
    it('regenerates result with override prompt and persists prompt change', async () => {
      const existing = buildResult();
      const updatedPromptId = 'prompt_user_custom';
      meetingService.findById.mockResolvedValue(buildMeeting());
      meetingService.updatePrompt.mockResolvedValue(buildMeeting());
      resultRepository.findOne.mockResolvedValue(existing);
      promptService.ensureExists.mockResolvedValue(
        undefined as unknown as void,
      );
      promptService.findById.mockResolvedValue(
        buildPrompt({
          id: updatedPromptId,
          name: '사용자 프롬프트',
          content: '새로운 포맷으로 정리',
          documentType: PromptDocumentType.MENTORING,
          isDefault: false,
        }),
      );
      noteRepository.findOne.mockResolvedValue({
        id: 'note-1',
        meetingId: 'meeting-1',
        content: '테스트 노트',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as NoteEntity);
      transcriptRepository.find.mockResolvedValue([]);
      bedrockService.extractStructuredNotes.mockResolvedValue({
        documentType: PromptDocumentType.MENTORING,
        summary: '실무 팁과 후속 과제를 정리했다.',
        topics: [
          {
            title: '배포 구조',
            keyPoints: ['배포 경로를 이해해야 한다'],
            practicalTips: ['태그 전략을 먼저 정하자'],
            followUpTasks: ['롤백 절차 문서화'],
            researchTopics: ['Docker-in-Docker'],
            cautions: ['근거 없는 태스크 확정 금지'],
          },
        ],
        keyTakeaways: ['타입에 맞는 문서화가 중요하다'],
        keywords: ['배포', '롤백'],
        uncertainties: [],
      });
      resultRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity as ResultEntity),
      );

      const regenerated = await service.regenerate('meeting-1', {
        promptId: updatedPromptId,
      });

      expect(promptService.ensureExists).toHaveBeenCalledWith(
        updatedPromptId,
        undefined,
      );
      expect(meetingService.updatePrompt).toHaveBeenCalledWith(
        'meeting-1',
        {
          promptId: updatedPromptId,
        },
        undefined,
      );
      expect(regenerated.promptId).toBe(updatedPromptId);
      expect(regenerated.content).toContain('## 핵심 주제');
      expect(regenerated.content).toContain('실무 팁');
      expect(regenerated.content).toContain('롤백 절차 문서화');
      expect(
        meetingSearchDocumentService.refreshByMeetingId,
      ).toHaveBeenCalledWith('meeting-1');
    });
  });

  describe('retry and fallback', () => {
    it('retries extraction 3 times then calls legacy fallback', async () => {
      // Setup: extraction always returns invalid (empty summary)
      meetingService.findById.mockResolvedValue(buildMeeting());
      resultRepository.findOne.mockResolvedValue(null);
      promptService.findById.mockResolvedValue(buildPrompt());
      noteRepository.findOne.mockResolvedValue({
        id: 'note-1',
        meetingId: 'meeting-1',
        content: '테스트 노트',
      } as NoteEntity);
      transcriptRepository.find.mockResolvedValue([
        {
          id: 'seg-1',
          meetingId: 'meeting-1',
          startTime: 0,
          endTime: 1,
          text: '테스트 전사',
          confidence: 0.95,
        } as TranscriptSegmentEntity,
      ]);
      bedrockService.extractStructuredNotes.mockResolvedValue({
        documentType: PromptDocumentType.MEETING,
        summary: '', // Will fail quality validation
        participants: [],
        agendaItems: [],
        overallDecisions: [],
        followUps: [],
        keywords: [],
        uncertainties: [],
      });
      bedrockService.generateMeetingResult.mockResolvedValue('# 레거시 결과');
      resultRepository.create.mockImplementation(
        (entity) => entity as ResultEntity,
      );
      resultRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity as ResultEntity),
      );

      const result = await service.findByMeetingId('meeting-1');

      expect(bedrockService.extractStructuredNotes).toHaveBeenCalledTimes(3);
      expect(bedrockService.generateMeetingResult).toHaveBeenCalledTimes(1);
      expect(result.content).toBe('# 레거시 결과');
    });

    it('rejects extracted content when meeting target language mismatches the summary script', async () => {
      meetingService.findById.mockResolvedValue(
        buildMeeting({ translateTargetLanguage: 'English' }),
      );
      resultRepository.findOne.mockResolvedValue(null);
      promptService.findById.mockResolvedValue(buildPrompt());
      noteRepository.findOne.mockResolvedValue(null);
      transcriptRepository.find.mockResolvedValue([
        {
          id: 'segment-1',
          meetingId: 'meeting-1',
          startTime: 0,
          endTime: 4,
          text: '한국어 회의 내용을 정리합니다',
          confidence: 0.95,
        } as TranscriptSegmentEntity,
      ]);
      bedrockService.extractStructuredNotes.mockResolvedValue({
        documentType: PromptDocumentType.MEETING,
        summary: '한국어로 작성된 회의 요약입니다.',
        participants: ['택준'],
        agendaItems: [
          {
            title: '안건',
            discussionPoints: ['핵심 내용을 공유했다'],
            decisions: ['다음 단계로 진행한다'],
            actionItems: [],
            unresolved: [],
          },
        ],
        overallDecisions: [],
        followUps: [],
        keywords: [],
        uncertainties: [],
      });
      bedrockService.generateMeetingResult.mockResolvedValue('# 레거시 결과');
      resultRepository.create.mockImplementation(
        (entity) => entity as ResultEntity,
      );
      resultRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity as ResultEntity),
      );

      const result = await service.findByMeetingId('meeting-1');

      expect(bedrockService.extractStructuredNotes).toHaveBeenCalledTimes(3);
      expect(bedrockService.generateMeetingResult).toHaveBeenCalledTimes(1);
      expect(result.content).toBe('# 레거시 결과');
    });

    it('returns fallback template when both extraction and legacy fail', async () => {
      meetingService.findById.mockResolvedValue(buildMeeting());
      resultRepository.findOne.mockResolvedValue(null);
      promptService.findById.mockResolvedValue(buildPrompt());
      noteRepository.findOne.mockResolvedValue({
        id: 'note-1',
        meetingId: 'meeting-1',
        content: '테스트 노트',
      } as NoteEntity);
      transcriptRepository.find.mockResolvedValue([]);
      bedrockService.extractStructuredNotes.mockRejectedValue(
        new Error('Bedrock error'),
      );
      bedrockService.generateMeetingResult.mockRejectedValue(
        new Error('Legacy error'),
      );
      resultRepository.create.mockImplementation(
        (entity) => entity as ResultEntity,
      );
      resultRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity as ResultEntity),
      );

      const result = await service.findByMeetingId('meeting-1');

      expect(bedrockService.extractStructuredNotes).toHaveBeenCalledTimes(3);
      expect(bedrockService.generateMeetingResult).toHaveBeenCalledTimes(1);
      expect(result.content).toContain('AI 회의록 생성에 일시적 문제가 발생');
    });
  });
});
