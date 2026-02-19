import { Controller, Get, Param } from '@nestjs/common';
import { TranscriptionService } from '../application/transcription.service';

@Controller('api/v1/meetings/:meetingId/transcripts')
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}

  @Get()
  async list(@Param('meetingId') meetingId: string) {
    const segments = await this.transcriptionService.listByMeetingId(meetingId);
    return { segments };
  }
}
