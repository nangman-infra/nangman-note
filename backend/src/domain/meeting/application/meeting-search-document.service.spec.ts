import { Repository, SelectQueryBuilder } from 'typeorm';
import { NoteEntity } from '../../note/domain/note.entity';
import { ResultEntity } from '../../result/domain/result.entity';
import { TranscriptSegmentEntity } from '../../transcription/domain/transcript-segment.entity';
import { MeetingEntity } from '../domain/meeting.entity';
import { MeetingSearchDocumentEntity } from '../domain/meeting-search-document.entity';
import { MeetingStatus } from '../domain/meeting-status.enum';
import { MeetingTranscriptionMode } from '../domain/meeting-transcription-mode.enum';
import { MeetingSearchDocumentService } from './meeting-search-document.service';

describe('MeetingSearchDocumentService', () => {
  let service: MeetingSearchDocumentService;
  let meetingRepository: jest.Mocked<
    Pick<Repository<MeetingEntity>, 'createQueryBuilder' | 'findOne'>
  >;
  let searchDocumentRepository: jest.Mocked<
    Pick<Repository<MeetingSearchDocumentEntity>, 'delete' | 'find'>
  >;
  let coverageQuery: jest.Mocked<
    Pick<
      SelectQueryBuilder<MeetingEntity>,
      | 'leftJoin'
      | 'select'
      | 'where'
      | 'andWhere'
      | 'orderBy'
      | 'limit'
      | 'getRawMany'
    >
  >;

  beforeEach(() => {
    coverageQuery = {
      leftJoin: jest.fn(),
      select: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      limit: jest.fn(),
      getRawMany: jest.fn(),
    };
    coverageQuery.leftJoin.mockReturnValue(coverageQuery as never);
    coverageQuery.select.mockReturnValue(coverageQuery as never);
    coverageQuery.where.mockReturnValue(coverageQuery as never);
    coverageQuery.andWhere.mockReturnValue(coverageQuery as never);
    coverageQuery.orderBy.mockReturnValue(coverageQuery as never);
    coverageQuery.limit.mockReturnValue(coverageQuery as never);
    meetingRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(
          coverageQuery as unknown as SelectQueryBuilder<MeetingEntity>,
        ),
      findOne: jest.fn(),
    };
    searchDocumentRepository = {
      delete: jest.fn().mockResolvedValue({ raw: [], affected: 1 }),
      find: jest.fn(),
    };
    service = new MeetingSearchDocumentService(
      meetingRepository as unknown as Repository<MeetingEntity>,
      searchDocumentRepository as unknown as Repository<MeetingSearchDocumentEntity>,
      {} as Repository<NoteEntity>,
      {} as Repository<ResultEntity>,
      {} as Repository<TranscriptSegmentEntity>,
    );
  });

  it('searches decrypted sensitive projection content and paginates matches', async () => {
    searchDocumentRepository.find.mockResolvedValue([
      buildDocument('meeting-2', '다른 노트', new Date('2026-08-26T02:00:00Z')),
      buildDocument(
        'meeting-1',
        '검색할 민감한 노트',
        new Date('2026-08-26T01:00:00Z'),
      ),
    ]);

    const result = await service.search({
      loweredKeyword: '민감한',
      scope: 'note',
      page: 1,
      limit: 10,
      ownerSub: 'user-1',
    });

    expect(searchDocumentRepository.find).toHaveBeenCalledTimes(1);
    expect(result.total).toBe(1);
    expect(result.rows).toEqual([
      expect.objectContaining({
        meetingId: 'meeting-1',
        noteContent: '검색할 민감한 노트',
      }),
    ]);
  });

  it('searches all decrypted projection fields', async () => {
    const document = buildDocument(
      'meeting-1',
      '노트',
      new Date('2026-08-26T01:00:00Z'),
    );
    document.transcriptContent = 'Unique Transcript';
    searchDocumentRepository.find.mockResolvedValue([document]);

    const result = await service.search({
      loweredKeyword: 'unique transcript',
      scope: 'all',
      page: 1,
      limit: 10,
    });

    expect(result.total).toBe(1);
  });

  it('reports incomplete owner coverage when more than 200 rows are missing', async () => {
    coverageQuery.getRawMany.mockResolvedValue(
      Array.from({ length: 201 }, (_, index) => ({ id: `meeting-${index}` })),
    );
    const refresh = jest
      .spyOn(service, 'refreshByMeetingId')
      .mockResolvedValue(true);

    await expect(service.ensureCoverage('owner-a')).resolves.toBe(false);

    expect(refresh).toHaveBeenCalledTimes(200);
    expect(coverageQuery.limit).toHaveBeenCalledWith(201);
    expect(coverageQuery.andWhere).toHaveBeenCalledWith(
      'meeting.owner_sub = :ownerSub',
      { ownerSub: 'owner-a' },
    );
  });

  it('checks completeness independently for each owner', async () => {
    coverageQuery.getRawMany
      .mockResolvedValueOnce([{ id: 'owner-a-meeting' }])
      .mockResolvedValueOnce([]);
    const refresh = jest
      .spyOn(service, 'refreshByMeetingId')
      .mockResolvedValue(true);

    await expect(service.ensureCoverage('owner-a')).resolves.toBe(true);

    expect(refresh).toHaveBeenCalledWith('owner-a-meeting');
    expect(coverageQuery.andWhere).toHaveBeenCalledWith(
      'meeting.owner_sub = :ownerSub',
      { ownerSub: 'owner-a' },
    );
  });

  it('reports incomplete coverage when a refresh fails', async () => {
    coverageQuery.getRawMany.mockResolvedValue([{ id: 'meeting-1' }]);
    jest.spyOn(service, 'refreshByMeetingId').mockResolvedValue(false);

    await expect(service.ensureCoverage('owner-a')).resolves.toBe(false);
  });

  it('invalidates a stale projection row when refresh fails', async () => {
    meetingRepository.findOne.mockRejectedValue(new Error('source failed'));

    await expect(service.refreshByMeetingId('meeting-1')).resolves.toBe(false);

    expect(searchDocumentRepository.delete).toHaveBeenCalledWith({
      meetingId: 'meeting-1',
    });
  });
});

function buildDocument(
  meetingId: string,
  noteContent: string,
  startedAt: Date,
): MeetingSearchDocumentEntity {
  const document = new MeetingSearchDocumentEntity();
  document.meetingId = meetingId;
  document.ownerSub = 'user-1';
  document.title = '제목';
  document.noteContent = noteContent;
  document.resultContent = '결과';
  document.transcriptContent = '전사';
  document.meeting = {
    id: meetingId,
    status: MeetingStatus.COMPLETED,
    needsAttention: false,
    transcriptionMode: MeetingTranscriptionMode.BATCH,
    startedAt,
  } as MeetingEntity;
  return document;
}
