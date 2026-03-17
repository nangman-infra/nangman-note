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
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import type { AuthUser } from '../../../shared/auth/auth-user.interface';

@Controller('api/v1/meetings/:meetingId/transcripts')
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}

  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  async generateUploadUrl(
    @Param('meetingId') meetingId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.transcriptionService.issueBatchUpload(meetingId, user?.sub);
  }

  @Get()
  async list(
    @Param('meetingId') meetingId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const segments = await this.transcriptionService.listByMeetingId(
      meetingId,
      user?.sub,
    );
    return { segments };
  }

  @Get('jobs')
  async listJobs(
    @Param('meetingId') meetingId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const jobs = await this.transcriptionService.listBatchJobsByMeetingId(
      meetingId,
      user?.sub,
    );
    return { jobs };
  }

  @Post('jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  async queueBatchJob(
    @Param('meetingId') meetingId: string,
    @Body() dto: CreateBatchTranscriptionJobDto,
    @CurrentUser() user?: AuthUser,
  ) {
    const job = await this.transcriptionService.queueBatchJob(meetingId, dto, user?.sub);
    return { job };
  }

  @Post('uploads/:uploadId/confirm')
  @HttpCode(HttpStatus.ACCEPTED)
  async confirmBatchUpload(
    @Param('meetingId') meetingId: string,
    @Param('uploadId') uploadId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const job = await this.transcriptionService.confirmBatchUpload(
      meetingId,
      uploadId,
      user?.sub,
    );
    return { job };
  }
}
