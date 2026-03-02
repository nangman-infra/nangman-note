import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import { CreateBatchTranscriptionJobDto } from '../application/dto/create-batch-transcription-job.dto';
import { TranscriptionService } from '../application/transcription.service';
import { TranscriptionResultCollectorService } from '../application/transcription-result-collector.service';
import { S3AudioService } from '../../../shared/aws/s3/s3.service';
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import type { AuthUser } from '../../../shared/auth/auth-user.interface';

@Controller('api/v1/meetings/:meetingId/transcripts')
export class TranscriptionController {
  private readonly logger = new Logger(TranscriptionController.name);

  constructor(
    private readonly transcriptionService: TranscriptionService,
    private readonly resultCollectorService: TranscriptionResultCollectorService,
    private readonly s3AudioService: S3AudioService,
  ) {}

  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  async generateUploadUrl(
    @Param('meetingId') meetingId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    // 회의 존재 여부 확인 (내부에서 NotFoundException 발생)
    await this.transcriptionService.listByMeetingId(meetingId, user?.sub);
    return this.s3AudioService.generateUploadUrl(meetingId);
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
    const job = await this.transcriptionService.queueBatchJob(
      meetingId,
      dto,
      user?.sub,
    );

    // 서버 측 비동기 폴링 시작 (프론트엔드 이탈 OK)
    this.resultCollectorService
      .pollAndCollect(meetingId, job.id)
      .then((result) => {
        this.logger.log(
          `[AsyncPoll] Meeting ${meetingId}: success=${result.success}, segments=${result.segmentCount}`,
        );
      })
      .catch((err: Error) => {
        this.logger.error(
          `[AsyncPoll] Meeting ${meetingId} failed: ${err.message}`,
        );
      });

    return { job };
  }
}
