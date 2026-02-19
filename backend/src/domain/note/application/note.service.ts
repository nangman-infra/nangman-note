import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeetingService } from '../../meeting/application/meeting.service';
import { NoteEntity } from '../domain/note.entity';
import { UpsertNoteDto } from './dto/upsert-note.dto';

@Injectable()
export class NoteService {
  constructor(
    @InjectRepository(NoteEntity)
    private readonly noteRepository: Repository<NoteEntity>,
    private readonly meetingService: MeetingService,
  ) {}

  async findByMeetingId(meetingId: string): Promise<NoteEntity> {
    await this.meetingService.findById(meetingId);

    const existing = await this.noteRepository.findOne({
      where: { meetingId },
    });

    if (existing) {
      return existing;
    }

    const now = new Date();
    return {
      id: `note_virtual_${meetingId}`,
      meetingId,
      content: '',
      createdAt: now,
      updatedAt: now,
    } as NoteEntity;
  }

  async upsert(meetingId: string, dto: UpsertNoteDto): Promise<NoteEntity> {
    await this.meetingService.findById(meetingId);

    const existing = await this.noteRepository.findOne({
      where: { meetingId },
    });

    if (existing) {
      existing.content = dto.content;
      return this.noteRepository.save(existing);
    }

    return this.noteRepository.save(
      this.noteRepository.create({
        meetingId,
        content: dto.content,
      }),
    );
  }
}
