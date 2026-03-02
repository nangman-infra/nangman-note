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
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import type { AuthUser } from '../../../shared/auth/auth-user.interface';

@Controller('api/v1/meetings/:meetingId/result')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @Get()
  async getByMeetingId(
    @Param('meetingId') meetingId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.resultService.findByMeetingId(meetingId, user?.sub);
  }

  @Patch()
  async update(
    @Param('meetingId') meetingId: string,
    @Body() dto: UpdateResultDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.resultService.update(meetingId, dto, user?.sub);
  }

  @Post('regenerate')
  async regenerate(
    @Param('meetingId') meetingId: string,
    @Body() dto: RegenerateResultDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.resultService.regenerate(meetingId, dto, user?.sub);
  }

  @Get('export')
  async export(
    @Param('meetingId') meetingId: string,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() user?: AuthUser,
  ): Promise<StreamableFile> {
    const exported = await this.resultService.exportResult(
      meetingId,
      format,
      user?.sub,
    );

    response.setHeader('Content-Type', exported.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${exported.fileName}"`,
    );

    return new StreamableFile(exported.buffer);
  }
}
