import { TranscriptionService } from '../application/transcription.service';
import { TranscriptionJobProvider } from '../domain/transcription-job-provider.enum';
import { TranscriptionJobStatus } from '../domain/transcription-job-status.enum';
import { TranscriptionJobEntity } from '../domain/transcription-job.entity';
import { TranscriptionController } from './transcription.controller';

describe('TranscriptionController', () => {
  let controller: TranscriptionController;
  let transcriptionService: jest.Mocked<
    Pick<
      TranscriptionService,
      'listBatchJobsByMeetingId' | 'queueBatchJob' | 'confirmBatchUpload'
    >
  >;

  beforeEach(() => {
    transcriptionService = {
      listBatchJobsByMeetingId: jest.fn(),
      queueBatchJob: jest.fn(),
      confirmBatchUpload: jest.fn(),
    };

    controller = new TranscriptionController(
      transcriptionService as unknown as TranscriptionService,
    );
  });

  it('returns only public job fields from list responses', async () => {
    transcriptionService.listBatchJobsByMeetingId.mockResolvedValue([
      buildJob(),
    ]);

    const response = await controller.listJobs('meeting-1');

    expect(response).toEqual({
      jobs: [
        {
          id: 'job-1',
          meetingId: 'meeting-1',
          provider: TranscriptionJobProvider.AWS_TRANSCRIBE,
          status: TranscriptionJobStatus.PROCESSING,
          languageCode: 'ko-KR',
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          updatedAt: new Date('2026-03-01T00:01:00.000Z'),
        },
      ],
    });
    expect(JSON.stringify(response)).not.toContain('provider-job-1');
    expect(JSON.stringify(response)).not.toContain('s3://');
    expect(JSON.stringify(response)).not.toContain('internal provider error');
  });
});

function buildJob(): TranscriptionJobEntity {
  return {
    id: 'job-1',
    meetingId: 'meeting-1',
    provider: TranscriptionJobProvider.AWS_TRANSCRIBE,
    providerJobId: 'provider-job-1',
    status: TranscriptionJobStatus.PROCESSING,
    mediaUri: 's3://audio-bucket/meeting-1/audio.webm',
    languageCode: 'ko-KR',
    transcriptUri: 's3://transcript-bucket/meeting-1/result.json',
    errorMessage: 'internal provider error',
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:01:00.000Z'),
  } as TranscriptionJobEntity;
}
