import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSettingsEntity } from '../user-settings/domain/user-settings.entity';
import { PromptService } from './application/prompt.service';
import { PromptEntity } from './domain/prompt.entity';
import { PromptController } from './infrastructure/prompt.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PromptEntity, UserSettingsEntity])],
  controllers: [PromptController],
  providers: [PromptService],
  exports: [PromptService, TypeOrmModule],
})
export class PromptModule {}
