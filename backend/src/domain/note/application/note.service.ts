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

    try {
      const saved = await this.noteRepository.save(
        this.noteRepository.create({
          meetingId,
          content: dto.content,
        }),
      );
      await this.meetingSearchDocumentService.refreshByMeetingId(meetingId);
      return saved;
    } catch (error) {
      // 두 탭이 동시에 최초 저장하면 findOne→insert 레이스로
      // unique(meeting_id) 위반이 발생할 수 있다. update로 폴백해
      // 사용자에게 500이 노출되지 않도록 한다.
      if (this.isUniqueConstraintError(error)) {
        const raced = await this.noteRepository.findOne({
          where: { meetingId },
        });
        if (raced) {
          raced.content = dto.content;
          const saved = await this.noteRepository.save(raced);
          await this.meetingSearchDocumentService.refreshByMeetingId(meetingId);
          return saved;
        }
      }
      throw error;
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
      message.includes('unique') ||
      message.includes('duplicate key') ||
      message.includes('constraint')
    );
  }
}
