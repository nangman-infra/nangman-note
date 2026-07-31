import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeetingModule } from '../meeting/meeting.module';
import { NoteService } from './application/note.service';
import { NoteEntity } from './domain/note.entity';
import { NoteController } from './infrastructure/note.controller';

@Module({
  imports: [TypeOrmModule.forFeature([NoteEntity]), MeetingModule],
  controllers: [NoteController],
  providers: [NoteService],
  exports: [NoteService, TypeOrmModule],
})
export class NoteModule {}
