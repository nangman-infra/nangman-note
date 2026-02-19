import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CreateBatchTranscriptionJobDto } from '../application/dto/create-batch-transcription-job.dto';
import { TranscriptionService } from '../application/transcription.service';

@Controller('api/v1/meetings/:meetingId/transcripts')
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}

  @Get()
  async list(@Param('meetingId') meetingId: string) {
    const segments = await this.transcriptionService.listByMeetingId(meetingId);
    return { segments };
  }

  @Get('jobs')
  async listJobs(@Param('meetingId') meetingId: string) {
    const jobs =
      await this.transcriptionService.listBatchJobsByMeetingId(meetingId);
    return { jobs };
  }

  @Post('jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  async queueBatchJob(
    @Param('meetingId') meetingId: string,
    @Body() dto: CreateBatchTranscriptionJobDto,
  ) {
    const job = await this.transcriptionService.queueBatchJob(meetingId, dto);
    return { job };
  }
}
