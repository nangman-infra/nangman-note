import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromptService } from './application/prompt.service';
import { PromptEntity } from './domain/prompt.entity';
import { PromptController } from './infrastructure/prompt.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PromptEntity])],
  controllers: [PromptController],
  providers: [PromptService],
  exports: [PromptService, TypeOrmModule],
})
export class PromptModule {}
