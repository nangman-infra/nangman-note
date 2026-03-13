import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeetingModule } from '../meeting/meeting.module';
import { ResultModule } from '../result/result.module';
import { MeetingEntity } from '../meeting/domain/meeting.entity';
import { ResultEntity } from '../result/domain/result.entity';
import { TranscriptionService } from './application/transcription.service';
import { StalledMeetingRecoveryService } from './application/stalled-meeting-recovery.service';
import { TranscriptionResultCollectorService } from './application/transcription-result-collector.service';
import { BATCH_TRANSCRIPTION_PROVIDER } from './application/ports/batch-transcription-provider.port';
import { STREAMING_TRANSCRIPTION_PROVIDER } from './application/ports/streaming-transcription-provider.port';
import { TRANSLATION_PROVIDER } from './application/ports/translation-provider.port';
import { TranscriptionJobEntity } from './domain/transcription-job.entity';
import { TranscriptSegmentEntity } from './domain/transcript-segment.entity';
import { AwsBatchTranscriptionProvider } from './infrastructure/aws-batch-transcription.provider';
import { AwsStreamingTranscriptionProvider } from './infrastructure/aws-streaming-transcription.provider';
import { TranscriptionController } from './infrastructure/transcription.controller';
import { TranscriptionGateway } from './infrastructure/transcription.gateway';
import { TranslateService } from '../../shared/aws/translate/translate.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TranscriptSegmentEntity,
      TranscriptionJobEntity,
      MeetingEntity,
      ResultEntity,
    ]),
    MeetingModule,
    ResultModule,
  ],
  controllers: [TranscriptionController],
  providers: [
    TranscriptionService,
    StalledMeetingRecoveryService,
    TranscriptionResultCollectorService,
    TranscriptionGateway,
    AwsBatchTranscriptionProvider,
    AwsStreamingTranscriptionProvider,
    {
      provide: BATCH_TRANSCRIPTION_PROVIDER,
      useExisting: AwsBatchTranscriptionProvider,
    },
    {
      provide: STREAMING_TRANSCRIPTION_PROVIDER,
      useExisting: AwsStreamingTranscriptionProvider,
    },
    {
      provide: TRANSLATION_PROVIDER,
      useExisting: TranslateService,
    },
  ],
  exports: [
    TranscriptionService,
    TranscriptionResultCollectorService,
    TypeOrmModule,
  ],
})
export class TranscriptionModule {}
