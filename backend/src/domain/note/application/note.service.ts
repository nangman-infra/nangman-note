import { ConflictException, Injectable } from '@nestjs/common';
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
      revision: 0,
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
      // An acknowledgement can be lost after a successful write. Retrying the
      // same content is safe and must not create a spurious conflict.
      if (existing.content === dto.content) return existing;
      if (existing.revision !== dto.expectedRevision) this.throwConflict();

      const updatedAt = new Date();
      // Pass an entity instance, including meetingId, so the encryption
      // subscriber applies its field AAD to this conditional UPDATE as well.
      const update = this.noteRepository.create({
        meetingId,
        content: dto.content,
        revision: dto.expectedRevision + 1,
        updatedAt,
      });
      const result = await this.noteRepository.update(
        { meetingId, revision: dto.expectedRevision },
        update,
      );
      if (result.affected !== 1) this.throwConflict();
      await this.meetingSearchDocumentService.refreshByMeetingId(meetingId);
      return Object.assign(existing, {
        content: dto.content,
        revision: dto.expectedRevision + 1,
        updatedAt,
      });
    }

    if (dto.expectedRevision !== 0) this.throwConflict();

    try {
      const saved = await this.noteRepository.save(
        this.noteRepository.create({
          meetingId,
          content: dto.content,
          revision: 1,
        }),
      );
      await this.meetingSearchDocumentService.refreshByMeetingId(meetingId);
      return saved;
    } catch (error) {
      // Simultaneous first saves must not silently overwrite the winning tab.
      if (this.isUniqueConstraintError(error)) {
        const raced = await this.noteRepository.findOne({
          where: { meetingId },
        });
        if (raced) {
          if (raced.content === dto.content) return raced;
          this.throwConflict();
        }
      }
      throw error;
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
      message.includes('unique constraint') || message.includes('duplicate key')
    );
  }

  private throwConflict(): never {
    throw new ConflictException(
      '다른 곳에서 노트가 수정되었습니다. 최신 노트와 작성 내용을 확인해주세요.',
    );
  }
}
