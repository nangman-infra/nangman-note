import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { UpsertNoteDto } from '../application/dto/upsert-note.dto';
import { NoteService } from '../application/note.service';

@Controller('api/v1/meetings/:meetingId/note')
export class NoteController {
  constructor(private readonly noteService: NoteService) {}

  @Get()
  async getByMeetingId(@Param('meetingId') meetingId: string) {
    return this.noteService.findByMeetingId(meetingId);
  }

  @Put()
  async upsert(
    @Param('meetingId') meetingId: string,
    @Body() dto: UpsertNoteDto,
  ) {
    return this.noteService.upsert(meetingId, dto);
  }
}
