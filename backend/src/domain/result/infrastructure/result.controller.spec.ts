import { ResultController } from './result.controller';
import { ResultService } from '../application/result.service';
import { ResultEntity } from '../domain/result.entity';

describe('ResultController', () => {
  let controller: ResultController;
  let resultService: jest.Mocked<
    Pick<ResultService, 'findByMeetingId' | 'update' | 'isRegenerating'>
  >;

  beforeEach(() => {
    resultService = {
      findByMeetingId: jest.fn(),
      update: jest.fn(),
      isRegenerating: jest.fn(),
    };

    controller = new ResultController(resultService as unknown as ResultService);
  });

  it('includes regeneration state in result responses', async () => {
    resultService.findByMeetingId.mockResolvedValue(buildResult());
    resultService.isRegenerating.mockReturnValue(true);

    const response = await controller.getByMeetingId('meeting-1');

    expect(resultService.findByMeetingId).toHaveBeenCalledWith(
      'meeting-1',
      undefined,
    );
    expect(resultService.isRegenerating).toHaveBeenCalledWith('meeting-1');
    expect(response).toEqual(
      expect.objectContaining({
        meetingId: 'meeting-1',
        isRegenerating: true,
      }),
    );
  });
});

function buildResult(overrides: Partial<ResultEntity> = {}): ResultEntity {
  return {
    id: 'result-1',
    meetingId: 'meeting-1',
    promptId: 'prompt_default_meeting',
    content: '# 결과',
    metadata: {
      title: '테스트 회의',
      generatedAt: '2026-03-07T00:00:00.000Z',
      totalDuration: 600,
      transcriptWordCount: 10,
      noteLength: 20,
    },
    createdAt: new Date('2026-03-07T00:00:00.000Z'),
    updatedAt: new Date('2026-03-07T00:00:00.000Z'),
    ...overrides,
  } as unknown as ResultEntity;
}
