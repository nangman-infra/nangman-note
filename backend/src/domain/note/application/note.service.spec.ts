import { Repository } from 'typeorm';
import { MeetingSearchDocumentService } from '../../meeting/application/meeting-search-document.service';
import { MeetingService } from '../../meeting/application/meeting.service';
import { NoteEntity } from '../domain/note.entity';
import { NoteService } from './note.service';

describe('NoteService', () => {
  let service: NoteService;
  let noteRepository: jest.Mocked<
    Pick<Repository<NoteEntity>, 'findOne' | 'create' | 'save' | 'update'>
  >;
  let meetingService: jest.Mocked<Pick<MeetingService, 'findById'>>;
  let meetingSearchDocumentService: jest.Mocked<
    Pick<MeetingSearchDocumentService, 'refreshByMeetingId'>
  >;

  const buildNote = (overrides: Partial<NoteEntity> = {}): NoteEntity =>
    ({
      id: 'note-1',
      meetingId: 'meeting-1',
      content: '기본 노트',
      revision: 1,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      ...overrides,
    }) as unknown as NoteEntity;

  beforeEach(() => {
    noteRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    noteRepository.create.mockImplementation((note) =>
      Object.assign(new NoteEntity(), note),
    );
    meetingService = {
      findById: jest.fn(),
    };
    meetingSearchDocumentService = {
      refreshByMeetingId: jest.fn(),
    };

    service = new NoteService(
      noteRepository as unknown as Repository<NoteEntity>,
      meetingService as unknown as MeetingService,
      meetingSearchDocumentService as unknown as MeetingSearchDocumentService,
    );
  });

  describe('findByMeetingId', () => {
    it('returns existing note when stored', async () => {
      const existing = buildNote();
      noteRepository.findOne.mockResolvedValue(existing);

      const result = await service.findByMeetingId('meeting-1');

      expect(meetingService.findById).toHaveBeenCalledWith(
        'meeting-1',
        undefined,
      );
      expect(noteRepository.findOne).toHaveBeenCalledWith({
        where: { meetingId: 'meeting-1' },
      });
      expect(result).toEqual(existing);
    });

    it('returns virtual empty note when no note exists yet', async () => {
      noteRepository.findOne.mockResolvedValue(null);

      const result = await service.findByMeetingId('meeting-1');

      expect(result.id).toBe('note_virtual_meeting-1');
      expect(result.meetingId).toBe('meeting-1');
      expect(result.content).toBe('');
      expect(result.revision).toBe(0);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('upsert', () => {
    it('updates existing note content', async () => {
      const existing = buildNote({ content: 'before' });
      noteRepository.findOne.mockResolvedValue(existing);
      noteRepository.update.mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });

      const result = await service.upsert('meeting-1', {
        content: 'after',
        expectedRevision: 1,
      });

      expect(noteRepository.update).toHaveBeenCalledWith(
        { meetingId: 'meeting-1', revision: 1 },
        expect.objectContaining({
          meetingId: 'meeting-1',
          content: 'after',
          revision: 2,
        }),
      );
      expect(noteRepository.update.mock.calls[0][1]).toBeInstanceOf(NoteEntity);
      expect(
        meetingSearchDocumentService.refreshByMeetingId,
      ).toHaveBeenCalledWith('meeting-1');
      expect(result.content).toBe('after');
      expect(result.revision).toBe(2);
    });

    it('creates and saves note when none exists', async () => {
      const created = buildNote({ content: '새 노트' });
      noteRepository.findOne.mockResolvedValue(null);
      noteRepository.create.mockReturnValue(created);
      noteRepository.save.mockResolvedValue(created);

      const result = await service.upsert('meeting-1', {
        content: '새 노트',
        expectedRevision: 0,
      });

      expect(noteRepository.create).toHaveBeenCalledWith({
        meetingId: 'meeting-1',
        content: '새 노트',
        revision: 1,
      });
      expect(noteRepository.save).toHaveBeenCalledWith(created);
      expect(
        meetingSearchDocumentService.refreshByMeetingId,
      ).toHaveBeenCalledWith('meeting-1');
      expect(result).toEqual(created);
    });

    it('rejects a stale writer without changing the note', async () => {
      noteRepository.findOne.mockResolvedValue(buildNote({ revision: 3 }));
      await expect(
        service.upsert('meeting-1', { content: 'stale', expectedRevision: 2 }),
      ).rejects.toMatchObject({ status: 409 });
      expect(noteRepository.update).not.toHaveBeenCalled();
    });

    it('rejects a write that loses the atomic revision comparison', async () => {
      noteRepository.findOne.mockResolvedValue(buildNote());
      noteRepository.update.mockResolvedValue({
        affected: 0,
        raw: [],
        generatedMaps: [],
      });
      await expect(
        service.upsert('meeting-1', { content: 'racing', expectedRevision: 1 }),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        meetingSearchDocumentService.refreshByMeetingId,
      ).not.toHaveBeenCalled();
    });

    it('accepts a retry after the save acknowledgement was lost', async () => {
      noteRepository.findOne.mockResolvedValue(
        buildNote({ content: 'saved', revision: 2 }),
      );
      const result = await service.upsert('meeting-1', {
        content: 'saved',
        expectedRevision: 1,
      });
      expect(result.revision).toBe(2);
      expect(noteRepository.update).not.toHaveBeenCalled();
    });

    it('rejects a racing first save rather than overwriting the winner', async () => {
      noteRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(buildNote());
      noteRepository.save.mockRejectedValue(
        new Error('UNIQUE constraint failed: note.meeting_id'),
      );
      await expect(
        service.upsert('meeting-1', { content: 'loser', expectedRevision: 0 }),
      ).rejects.toMatchObject({ status: 409 });
      expect(noteRepository.update).not.toHaveBeenCalled();
    });
  });
});
