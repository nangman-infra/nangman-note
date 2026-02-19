import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeetingModule } from '../meeting/meeting.module';
import { TranscriptionService } from './application/transcription.service';
import { BATCH_TRANSCRIPTION_PROVIDER } from './application/ports/batch-transcription-provider.port';
import { TranscriptionJobEntity } from './domain/transcription-job.entity';
import { TranscriptSegmentEntity } from './domain/transcript-segment.entity';
import { AwsBatchTranscriptionProvider } from './infrastructure/aws-batch-transcription.provider';
import { TranscriptionController } from './infrastructure/transcription.controller';
import { TranscriptionGateway } from './infrastructure/transcription.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([TranscriptSegmentEntity, TranscriptionJobEntity]),
    MeetingModule,
  ],
  controllers: [TranscriptionController],
  providers: [
    TranscriptionService,
    TranscriptionGateway,
    AwsBatchTranscriptionProvider,
    {
      provide: BATCH_TRANSCRIPTION_PROVIDER,
      useExisting: AwsBatchTranscriptionProvider,
    },
  ],
  exports: [TranscriptionService, TypeOrmModule],
})
export class TranscriptionModule {}
