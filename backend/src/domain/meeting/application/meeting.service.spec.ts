import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { PromptService } from '../../prompt/application/prompt.service';
import { MeetingStatusChangedEvent } from '../../../shared/events/meeting-status-changed.event';
import { MeetingSearchDocumentService } from './meeting-search-document.service';
import { MeetingEntity } from '../domain/meeting.entity';
import { MeetingStatus } from '../domain/meeting-status.enum';
import { MeetingTranscriptionMode } from '../domain/meeting-transcription-mode.enum';
import { SearchMeetingsQueryDto } from './dto/search-meetings-query.dto';
import { MeetingService } from './meeting.service';

describe('MeetingService', () => {
  let service: MeetingService;
  let meetingRepository: jest.Mocked<
    Pick<Repository<MeetingEntity>, 'create' | 'findOne' | 'save'>
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
      findOne: jest.fn(),
      save: jest.fn(),
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
          phase: 'transcribing',
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
          phase: 'generating',
        }),
      );
    });

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
          phase: 'generating',
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

  describe('search', () => {
    it('returns mapped search results from projection rows', async () => {
      meetingSearchDocumentService.ensureCoverage.mockResolvedValue(0);
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

      expect(meetingSearchDocumentService.ensureCoverage).toHaveBeenCalled();
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
  });
});
