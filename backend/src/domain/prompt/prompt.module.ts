import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSettingsEntity } from '../user-settings/domain/user-settings.entity';
import { MeetingEntity } from '../meeting/domain/meeting.entity';
import { PromptService } from './application/prompt.service';
import { PromptEntity } from './domain/prompt.entity';
import { PromptController } from './infrastructure/prompt.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PromptEntity, UserSettingsEntity, MeetingEntity]),
  ],
  controllers: [PromptController],
  providers: [PromptService],
  exports: [PromptService, TypeOrmModule],
})
export class PromptModule {}
