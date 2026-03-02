import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeetingSearchDocumentService } from '../../meeting/application/meeting-search-document.service';
import { MeetingService } from '../../meeting/application/meeting.service';
import { NoteEntity } from '../domain/note.entity';
import { UpsertNoteDto } from './dto/upsert-note.dto';

@Injectable()
export class NoteService {
  constructor(
    @InjectRepository(NoteEntity)
    private readonly noteRepository: Repository<NoteEntity>,
    private readonly meetingService: MeetingService,
    private readonly meetingSearchDocumentService: MeetingSearchDocumentService,
  ) {}

  async findByMeetingId(
    meetingId: string,
    ownerSub?: string,
  ): Promise<NoteEntity> {
    await this.meetingService.findById(meetingId, ownerSub);

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

  async upsert(
    meetingId: string,
    dto: UpsertNoteDto,
    ownerSub?: string,
  ): Promise<NoteEntity> {
    await this.meetingService.findById(meetingId, ownerSub);

    const existing = await this.noteRepository.findOne({
      where: { meetingId },
    });

    if (existing) {
      existing.content = dto.content;
      const saved = await this.noteRepository.save(existing);
      await this.meetingSearchDocumentService.refreshByMeetingId(meetingId);
      return saved;
    }

    const saved = await this.noteRepository.save(
      this.noteRepository.create({
        meetingId,
        content: dto.content,
      }),
    );
    await this.meetingSearchDocumentService.refreshByMeetingId(meetingId);
    return saved;
  }
}
