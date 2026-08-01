import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CreateBatchTranscriptionJobDto } from '../application/dto/create-batch-transcription-job.dto';
import { TranscriptionService } from '../application/transcription.service';
import { TranscriptionJobEntity } from '../domain/transcription-job.entity';
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import type { AuthUser } from '../../../shared/auth/auth-user.interface';

interface TranscriptionJobResponse {
  id: string;
  meetingId: string;
  provider: string;
  status: string;
  languageCode: string;
  createdAt: Date;
  updatedAt: Date;
}

@Controller('api/v1/meetings/:meetingId/transcripts')
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}

  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  async generateUploadUrl(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.transcriptionService.issueBatchUpload(meetingId, user?.sub);
  }

  @Get()
  async list(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
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
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const jobs = await this.transcriptionService.listBatchJobsByMeetingId(
      meetingId,
      user?.sub,
    );
    return { jobs: jobs.map((job) => this.toJobResponse(job)) };
  }

  @Post('jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  async queueBatchJob(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body() dto: CreateBatchTranscriptionJobDto,
    @CurrentUser() user?: AuthUser,
  ) {
    const job = await this.transcriptionService.queueBatchJob(
      meetingId,
      dto,
      user?.sub,
    );
    return { job: this.toJobResponse(job) };
  }

  @Post('uploads/:uploadId/confirm')
  @HttpCode(HttpStatus.ACCEPTED)
  async confirmBatchUpload(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const job = await this.transcriptionService.confirmBatchUpload(
      meetingId,
      uploadId,
      user?.sub,
    );
    return { job: this.toJobResponse(job) };
  }

  private toJobResponse(job: TranscriptionJobEntity): TranscriptionJobResponse {
    return {
      id: job.id,
      meetingId: job.meetingId,
      provider: job.provider,
      status: job.status,
      languageCode: job.languageCode,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}
