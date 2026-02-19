import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { RegenerateResultDto } from '../application/dto/regenerate-result.dto';
import { UpdateResultDto } from '../application/dto/update-result.dto';
import { ResultService } from '../application/result.service';

@Controller('api/v1/meetings/:meetingId/result')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @Get()
  async getByMeetingId(@Param('meetingId') meetingId: string) {
    return this.resultService.findByMeetingId(meetingId);
  }

  @Patch()
  async update(
    @Param('meetingId') meetingId: string,
    @Body() dto: UpdateResultDto,
  ) {
    return this.resultService.update(meetingId, dto);
  }

  @Post('regenerate')
  async regenerate(
    @Param('meetingId') meetingId: string,
    @Body() dto: RegenerateResultDto,
  ) {
    return this.resultService.regenerate(meetingId, dto);
  }

  @Get('export')
  async export(
    @Param('meetingId') meetingId: string,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const exported = await this.resultService.exportResult(meetingId, format);

    response.setHeader('Content-Type', exported.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${exported.fileName}"`,
    );

    return new StreamableFile(exported.buffer);
  }
}
