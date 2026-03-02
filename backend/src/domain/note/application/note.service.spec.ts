import { Repository } from 'typeorm';
import { MeetingSearchDocumentService } from '../../meeting/application/meeting-search-document.service';
import { MeetingService } from '../../meeting/application/meeting.service';
import { NoteEntity } from '../domain/note.entity';
import { NoteService } from './note.service';

describe('NoteService', () => {
  let service: NoteService;
  let noteRepository: jest.Mocked<
    Pick<Repository<NoteEntity>, 'findOne' | 'create' | 'save'>
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
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      ...overrides,
    }) as unknown as NoteEntity;

  beforeEach(() => {
    noteRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
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
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('upsert', () => {
    it('updates existing note content', async () => {
      const existing = buildNote({ content: 'before' });
      noteRepository.findOne.mockResolvedValue(existing);
      noteRepository.save.mockImplementation((note) =>
        Promise.resolve(note as NoteEntity),
      );

      const result = await service.upsert('meeting-1', { content: 'after' });

      expect(existing.content).toBe('after');
      expect(noteRepository.save).toHaveBeenCalledWith(existing);
      expect(
        meetingSearchDocumentService.refreshByMeetingId,
      ).toHaveBeenCalledWith('meeting-1');
      expect(result.content).toBe('after');
    });

    it('creates and saves note when none exists', async () => {
      const created = buildNote({ content: '새 노트' });
      noteRepository.findOne.mockResolvedValue(null);
      noteRepository.create.mockReturnValue(created);
      noteRepository.save.mockResolvedValue(created);

      const result = await service.upsert('meeting-1', { content: '새 노트' });

      expect(noteRepository.create).toHaveBeenCalledWith({
        meetingId: 'meeting-1',
        content: '새 노트',
      });
      expect(noteRepository.save).toHaveBeenCalledWith(created);
      expect(
        meetingSearchDocumentService.refreshByMeetingId,
      ).toHaveBeenCalledWith('meeting-1');
      expect(result).toEqual(created);
    });
  });
});
