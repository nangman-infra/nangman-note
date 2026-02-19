import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeetingModule } from '../meeting/meeting.module';
import { NoteEntity } from '../note/domain/note.entity';
import { PromptModule } from '../prompt/prompt.module';
import { TranscriptSegmentEntity } from '../transcription/domain/transcript-segment.entity';
import { ResultService } from './application/result.service';
import { ResultEntity } from './domain/result.entity';
import { ResultController } from './infrastructure/result.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ResultEntity,
      NoteEntity,
      TranscriptSegmentEntity,
    ]),
    MeetingModule,
    PromptModule,
  ],
  controllers: [ResultController],
  providers: [ResultService],
  exports: [ResultService, TypeOrmModule],
})
export class ResultModule {}
