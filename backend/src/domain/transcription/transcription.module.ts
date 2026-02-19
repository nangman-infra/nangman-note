import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeetingModule } from '../meeting/meeting.module';
import { TranscriptionService } from './application/transcription.service';
import { TranscriptSegmentEntity } from './domain/transcript-segment.entity';
import { TranscriptionController } from './infrastructure/transcription.controller';
import { TranscriptionGateway } from './infrastructure/transcription.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([TranscriptSegmentEntity]), MeetingModule],
  controllers: [TranscriptionController],
  providers: [TranscriptionService, TranscriptionGateway],
  exports: [TranscriptionService, TypeOrmModule],
})
export class TranscriptionModule {}
