import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromptModule } from '../prompt/prompt.module';
import { MeetingService } from './application/meeting.service';
import { MeetingEntity } from './domain/meeting.entity';
import { MeetingController } from './infrastructure/meeting.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MeetingEntity]), PromptModule],
  controllers: [MeetingController],
  providers: [MeetingService],
  exports: [MeetingService, TypeOrmModule],
})
export class MeetingModule {}
