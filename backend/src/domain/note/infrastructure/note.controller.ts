import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { UpsertNoteDto } from '../application/dto/upsert-note.dto';
import { NoteService } from '../application/note.service';
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import type { AuthUser } from '../../../shared/auth/auth-user.interface';

@Controller('api/v1/meetings/:meetingId/note')
export class NoteController {
  constructor(private readonly noteService: NoteService) {}

  @Get()
  async getByMeetingId(
    @Param('meetingId') meetingId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.noteService.findByMeetingId(meetingId, user?.sub);
  }

  @Put()
  async upsert(
    @Param('meetingId') meetingId: string,
    @Body() dto: UpsertNoteDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.noteService.upsert(meetingId, dto, user?.sub);
  }
}
