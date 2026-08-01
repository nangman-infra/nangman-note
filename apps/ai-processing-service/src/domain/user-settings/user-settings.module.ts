import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromptModule } from '../prompt/prompt.module';
import { UserSettingsService } from './application/user-settings.service';
import { UserSettingsEntity } from './domain/user-settings.entity';
import { UserSettingsController } from './infrastructure/user-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserSettingsEntity]), PromptModule],
  controllers: [UserSettingsController],
  providers: [UserSettingsService],
  exports: [UserSettingsService, TypeOrmModule],
})
export class UserSettingsModule {}
