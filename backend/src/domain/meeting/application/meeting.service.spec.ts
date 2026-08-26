import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { PromptService } from '../../prompt/application/prompt.service';
import { MeetingStatusChangedEvent } from '../../../shared/events/meeting-status-changed.event';
import { MeetingSearchDocumentService } from './meeting-search-document.service';
import { MeetingCompletionState } from '../domain/meeting-completion-state.enum';
import { MeetingEntity } from '../domain/meeting.entity';
import { MeetingProcessingPhase } from '../domain/meeting-processing-phase.enum';
import { MeetingStatus } from '../domain/meeting-status.enum';
import { MeetingTranscriptionMode } from '../domain/meeting-transcription-mode.enum';
import { SearchMeetingsQueryDto } from './dto/search-meetings-query.dto';
import { ResultEntity } from '../../result/domain/result.entity';
import { NoteEntity } from '../../note/domain/note.entity';
import { TranscriptionJobEntity } from '../../transcription/domain/transcription-job.entity';
import { TranscriptionUploadEntity } from '../../transcription/domain/transcription-upload.entity';
import { MeetingService } from './meeting.service';

describe('MeetingService', () => {
  let service: MeetingService;
  let meetingRepository: jest.Mocked<
    Pick<Repository<MeetingEntity>, 'create' | 'find' | 'findOne' | 'save'>
  >;
  let resultRepository: jest.Mocked<
    Pick<Repository<ResultEntity>, 'findOne' | 'save'>
  >;
  let transcriptionJobRepository: jest.Mocked<
    Pick<Repository<TranscriptionJobEntity>, 'count'>
  >;
  let transcriptionUploadRepository: jest.Mocked<
    Pick<Repository<TranscriptionUploadEntity>, 'count'>
  >;
  let promptService: jest.Mocked<Pick<PromptService, 'ensureExists'>>;
  let eventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit'>>;
  let meetingSearchDocumentService: jest.Mocked<
    Pick<
      MeetingSearchDocumentService,
      'refreshByMeetingId' | 'ensureCoverage' | 'search'
    >
  >;

  const buildMeeting = (
    overrides: Partial<MeetingEntity> = {},
  ): MeetingEntity =>
    ({
      id: 'meeting-1',
      promptId: 'prompt_default_meeting',
      status: MeetingStatus.RECORDING,
      transcriptionMode: MeetingTranscriptionMode.BATCH,
      startedAt: new Date('2026-03-01T00:00:00.000Z'),
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      ...overrides,
    }) as unknown as MeetingEntity;

  beforeEach(() => {
    meetingRepository = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    resultRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    transcriptionJobRepository = {
      count: jest.fn().mockResolvedValue(0),
    };
    transcriptionUploadRepository = {
      count: jest.fn().mockResolvedValue(0),
    };
    promptService = {
      ensureExists: jest.fn(),
    };
    eventEmitter = {
      emit: jest.fn(),
    };
    meetingSearchDocumentService = {
      refreshByMeetingId: jest.fn(),
      ensureCoverage: jest.fn(),
      search: jest.fn(),
    };

    service = new MeetingService(
      meetingRepository as unknown as Repository<MeetingEntity>,
      resultRepository as unknown as Repository<ResultEntity>,
      transcriptionJobRepository as unknown as Repository<TranscriptionJobEntity>,
      transcriptionUploadRepository as unknown as Repository<TranscriptionUploadEntity>,
      promptService as unknown as PromptService,
      eventEmitter as unknown as EventEmitter2,
      meetingSearchDocumentService as unknown as MeetingSearchDocumentService,
    );
  });

  describe('complete', () => {
    it('sets batch meeting to processing by default', async () => {
      const meeting = buildMeeting({
        transcriptionMode: MeetingTranscriptionMode.BATCH,
      });
      meetingRepository.findOne.mockResolvedValue(meeting);
      meetingRepository.save.mockImplementation((value) =>
        Promise.resolve(value as MeetingEntity),
      );

      const result = await service.complete(meeting.id);

      expect(result.status).toBe(MeetingStatus.PROCESSING);
      expect(result.endedAt).toBeInstanceOf(Date);
      expect(meetingRepository.save).toHaveBeenCalledWith(meeting);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        MeetingStatusChangedEvent.EVENT_NAME,
        expect.objectContaining({
          meetingId: meeting.id,
          status: MeetingStatus.PROCESSING,
          phase: MeetingProcessingPhase.UPLOADING,
          needsAttention: false,
        }),
      );
    });

    it('sets realtime meeting to processing for result generation', async () => {
      const meeting = buildMeeting({
        transcriptionMode: MeetingTranscriptionMode.REALTIME,
      });
      meetingRepository.findOne.mockResolvedValue(meeting);
      meetingRepository.save.mockImplementation((value) =>
        Promise.resolve(value as MeetingEntity),
      );

      const result = await service.complete(meeting.id);

      expect(result.status).toBe(MeetingStatus.PROCESSING);
      expect(result.endedAt).toBeInstanceOf(Date);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        MeetingStatusChangedEvent.EVENT_NAME,
        expect.objectContaining({
          meetingId: meeting.id,
          status: MeetingStatus.PROCESSING,
          phase: MeetingProcessingPhase.GENERATING,
        }),
      );
    });

    it('advances directly to generating when fast batch jobs already settled', async () => {
      const meeting = buildMeeting({
        transcriptionMode: MeetingTranscriptionMode.BATCH,
      });
      meetingRepository.findOne.mockResolvedValue(meeting);
      meetingRepository.save.mockImplementation((value) =>
        Promise.resolve(value as MeetingEntity),
      );
      transcriptionJobRepository.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);
      transcriptionUploadRepository.count.mockResolvedValue(0);

      const result = await service.complete(meeting.id);

      expect(result.processingPhase).toBe(MeetingProcessingPhase.GENERATING);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        MeetingStatusChangedEvent.EVENT_NAME,
        expect.objectContaining({
          meetingId: meeting.id,
          phase: MeetingProcessingPhase.GENERATING,
        }),
      );
    });

    it.each([
      ['a collection-failed job', 1, 0],
      ['a pending upload', 0, 1],
    ])(
      'stays uploading when there is %s',
      async (_caseName, unsettled, uploads) => {
        const meeting = buildMeeting({
          transcriptionMode: MeetingTranscriptionMode.BATCH,
        });
        meetingRepository.findOne.mockResolvedValue(meeting);
        meetingRepository.save.mockImplementation((value) =>
          Promise.resolve(value as MeetingEntity),
        );
        transcriptionJobRepository.count
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(unsettled);
        transcriptionUploadRepository.count.mockResolvedValue(uploads);

        const result = await service.complete(meeting.id);

        expect(result.processingPhase).toBe(MeetingProcessingPhase.UPLOADING);
      },
    );

    it('sets batch meeting to processing when skipTranscription=true', async () => {
      const meeting = buildMeeting({
        transcriptionMode: MeetingTranscriptionMode.BATCH,
      });
      meetingRepository.findOne.mockResolvedValue(meeting);
      meetingRepository.save.mockImplementation((value) =>
        Promise.resolve(value as MeetingEntity),
      );

      const result = await service.complete(meeting.id, {
        skipTranscription: true,
      });

      expect(result.status).toBe(MeetingStatus.PROCESSING);
      expect(result.endedAt).toBeInstanceOf(Date);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        MeetingStatusChangedEvent.EVENT_NAME,
        expect.objectContaining({
          meetingId: meeting.id,
          status: MeetingStatus.PROCESSING,
          phase: MeetingProcessingPhase.GENERATING,
        }),
      );
    });

    it('throws NotFoundException when meeting does not exist', async () => {
      meetingRepository.findOne.mockResolvedValue(null);

      await expect(service.complete('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('uses default prompt id and batch mode when optional fields are omitted', async () => {
      const created = buildMeeting({
        promptId: 'prompt_default_meeting',
        transcriptionMode: MeetingTranscriptionMode.BATCH,
      });
      meetingRepository.create.mockReturnValue(created);
      meetingRepository.save.mockResolvedValue(created);

      const result = await service.create({});

      expect(promptService.ensureExists).toHaveBeenCalledWith(
        'prompt_default_meeting',
        undefined,
      );
      expect(meetingRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          promptId: 'prompt_default_meeting',
          transcriptionMode: MeetingTranscriptionMode.BATCH,
          status: MeetingStatus.RECORDING,
        }),
      );
      expect(
        meetingSearchDocumentService.refreshByMeetingId,
      ).toHaveBeenCalledWith(created.id);
      expect(result).toEqual(created);
    });

    it('trims title and persists user-selected prompt/mode', async () => {
      const created = buildMeeting({
        title: 'trimmed title',
        promptId: 'prompt_user_custom',
        transcriptionMode: MeetingTranscriptionMode.REALTIME,
      });
      meetingRepository.create.mockReturnValue(created);
      meetingRepository.save.mockResolvedValue(created);

      await service.create({
        title: '   trimmed title   ',
        promptId: 'prompt_user_custom',
        transcriptionMode: MeetingTranscriptionMode.REALTIME,
      });

      expect(promptService.ensureExists).toHaveBeenCalledWith(
        'prompt_user_custom',
        undefined,
      );
      expect(meetingRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'trimmed title',
          promptId: 'prompt_user_custom',
          transcriptionMode: MeetingTranscriptionMode.REALTIME,
        }),
      );
    });
  });

  describe('markNeedsAttention', () => {
    it('sets completion state for completed meetings', async () => {
      const meeting = buildMeeting({
        status: MeetingStatus.COMPLETED,
      });
      meetingRepository.findOne.mockResolvedValue(meeting);
      meetingRepository.save.mockImplementation((value) =>
        Promise.resolve(value as MeetingEntity),
      );

      const result = await service.markNeedsAttention(meeting.id);

      expect(result.needsAttention).toBe(true);
      expect(result.completionState).toBe(
        MeetingCompletionState.ATTENTION_REQUIRED,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        MeetingStatusChangedEvent.EVENT_NAME,
        expect.objectContaining({
          meetingId: meeting.id,
          status: MeetingStatus.COMPLETED,
          completionState: MeetingCompletionState.ATTENTION_REQUIRED,
          needsAttention: true,
        }),
      );
    });
  });

  describe('search', () => {
    it('returns mapped search results from projection rows', async () => {
      meetingSearchDocumentService.ensureCoverage.mockResolvedValue(true);
      meetingSearchDocumentService.search.mockResolvedValue({
        rows: [
          {
            meetingId: 'meeting-1',
            title: '주간 운영 회의',
            noteContent: '이번 주 운영 이슈를 정리합니다.',
            resultContent: '',
            transcriptContent: '',
            status: MeetingStatus.COMPLETED,
            transcriptionMode: MeetingTranscriptionMode.BATCH,
            needsAttention: false,
            startedAt: new Date('2026-03-01T00:00:00.000Z'),
          },
        ],
        total: 1,
      });

      const query: SearchMeetingsQueryDto = {
        q: '운영',
        scope: 'all',
      };
      const response = await service.search(query);

      expect(meetingSearchDocumentService.ensureCoverage).toHaveBeenCalledWith(
        undefined,
      );
      expect(meetingSearchDocumentService.search).toHaveBeenCalledWith({
        loweredKeyword: '운영',
        scope: 'all',
        page: 1,
        limit: 50,
      });
      expect(response.pagination.total).toBe(1);
      expect(response.results[0]).toEqual(
        expect.objectContaining({
          meetingId: 'meeting-1',
          status: MeetingStatus.COMPLETED,
          transcriptionMode: MeetingTranscriptionMode.BATCH,
        }),
      );
    });

    it('falls back to source entities when owner projection coverage is incomplete', async () => {
      meetingSearchDocumentService.ensureCoverage.mockResolvedValue(false);
      meetingRepository.find.mockResolvedValue([
        buildMeeting({
          id: 'older-meeting-201',
          ownerSub: 'owner-a',
          title: '오래된 회의',
          note: { content: '누락되면 안 되는 검색어' } as NoteEntity,
        }),
      ]);

      const response = await service.search(
        { q: '누락되면 안 되는', scope: 'note' },
        'owner-a',
      );

      expect(meetingSearchDocumentService.ensureCoverage).toHaveBeenCalledWith(
        'owner-a',
      );
      expect(meetingSearchDocumentService.search).not.toHaveBeenCalled();
      expect(meetingRepository.find).toHaveBeenCalledWith({
        where: { ownerSub: 'owner-a' },
        relations: { note: true, result: true, transcripts: true },
        order: { startedAt: 'DESC' },
      });
      expect(response.results[0]?.meetingId).toBe('older-meeting-201');
      expect(response.pagination.total).toBe(1);
    });
  });
});
