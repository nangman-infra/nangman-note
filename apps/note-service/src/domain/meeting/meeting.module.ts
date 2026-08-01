import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NoteEntity } from '../note/domain/note.entity';
import { PromptModule } from '../prompt/prompt.module';
import { ResultEntity } from '../result/domain/result.entity';
import { TranscriptSegmentEntity } from '../transcription/domain/transcript-segment.entity';
import { MeetingSearchDocumentService } from './application/meeting-search-document.service';
import { MeetingService } from './application/meeting.service';
import { MeetingEntity } from './domain/meeting.entity';
import { MeetingSearchDocumentEntity } from './domain/meeting-search-document.entity';
import { MeetingController } from './infrastructure/meeting.controller';
import { MeetingStatusGateway } from './infrastructure/meeting-status.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MeetingEntity,
      MeetingSearchDocumentEntity,
      NoteEntity,
      ResultEntity,
      TranscriptSegmentEntity,
    ]),
    PromptModule,
  ],
  controllers: [MeetingController],
  providers: [
    MeetingService,
    MeetingSearchDocumentService,
    MeetingStatusGateway,
  ],
  exports: [MeetingService, MeetingSearchDocumentService, TypeOrmModule],
})
export class MeetingModule {}
