import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BedrockService } from '../../../shared/aws/bedrock/bedrock.service';
import { MeetingSearchDocumentService } from '../../meeting/application/meeting-search-document.service';
import { MeetingService } from '../../meeting/application/meeting.service';
import { MeetingEntity } from '../../meeting/domain/meeting.entity';
import { MeetingStatus } from '../../meeting/domain/meeting-status.enum';
import { MeetingTranscriptionMode } from '../../meeting/domain/meeting-transcription-mode.enum';
import { NoteEntity } from '../../note/domain/note.entity';
import { PromptService } from '../../prompt/application/prompt.service';
import { PromptEntity } from '../../prompt/domain/prompt.entity';
import { TranscriptSegmentEntity } from '../../transcription/domain/transcript-segment.entity';
import { ResultEntity } from '../domain/result.entity';
import { ResultService } from './result.service';

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
    Pick<MeetingService, 'findById' | 'updatePrompt'>
  >;
  let promptService: jest.Mocked<
    Pick<PromptService, 'ensureExists' | 'findById'>
  >;
  let meetingSearchDocumentService: jest.Mocked<
    Pick<MeetingSearchDocumentService, 'refreshByMeetingId'>
  >;
  let bedrockService: jest.Mocked<
    Pick<BedrockService, 'generateMeetingResult'>
  >;

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
    };
    promptService = {
      ensureExists: jest.fn(),
      findById: jest.fn(),
    };
    meetingSearchDocumentService = {
      refreshByMeetingId: jest.fn(),
    };
    bedrockService = {
      generateMeetingResult: jest.fn(),
    };

    service = new ResultService(
      resultRepository as unknown as Repository<ResultEntity>,
      noteRepository as unknown as Repository<NoteEntity>,
      transcriptRepository as unknown as Repository<TranscriptSegmentEntity>,
      meetingService as unknown as MeetingService,
      meetingSearchDocumentService as unknown as MeetingSearchDocumentService,
      promptService as unknown as PromptService,
      bedrockService as unknown as BedrockService,
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
      bedrockService.generateMeetingResult.mockResolvedValue('# AI 결과');
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
      expect(createArg.content).toBe('# AI 결과');
      expect(createArg.metadata?.totalDuration).toBe(600);
      expect(createArg.metadata?.transcriptWordCount).toBe(2);
      expect(createArg.metadata?.noteLength).toBe(5);
      expect(
        meetingSearchDocumentService.refreshByMeetingId,
      ).toHaveBeenCalledWith('meeting-1');
      expect(result.content).toBe('# AI 결과');
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
      bedrockService.generateMeetingResult.mockResolvedValue('재생성 결과');
      resultRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity as ResultEntity),
      );

      const regenerated = await service.regenerate('meeting-1', {
        promptId: updatedPromptId,
      });

      expect(promptService.ensureExists).toHaveBeenCalledWith(updatedPromptId);
      expect(meetingService.updatePrompt).toHaveBeenCalledWith('meeting-1', {
        promptId: updatedPromptId,
      });
      expect(regenerated.promptId).toBe(updatedPromptId);
      expect(regenerated.content).toBe('재생성 결과');
      expect(
        meetingSearchDocumentService.refreshByMeetingId,
      ).toHaveBeenCalledWith('meeting-1');
    });
  });

  describe('exportResult', () => {
    it('exports markdown result buffer', async () => {
      const existing = buildResult({ content: '# Markdown' });
      meetingService.findById.mockResolvedValue(buildMeeting());
      resultRepository.findOne.mockResolvedValue(existing);

      const exported = await service.exportResult('meeting-1', 'md');

      expect(exported.fileName).toMatch(
        /^meeting_meeting-1_\d{4}-\d{2}-\d{2}\.md$/u,
      );
      expect(exported.contentType).toBe('text/markdown; charset=utf-8');
      expect(exported.buffer.toString('utf-8')).toBe('# Markdown');
    });

    it('throws BadRequestException on unsupported export format', async () => {
      const existing = buildResult();
      meetingService.findById.mockResolvedValue(buildMeeting());
      resultRepository.findOne.mockResolvedValue(existing);

      await expect(
        service.exportResult('meeting-1', 'txt'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
