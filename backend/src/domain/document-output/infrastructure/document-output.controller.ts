import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import type { AuthUser } from '../../../shared/auth/auth-user.interface';
import { DocumentOutputService } from '../application/document-output.service';

@Controller('api/v1/meetings/:meetingId/result')
export class DocumentOutputController {
  constructor(private readonly documentOutputService: DocumentOutputService) {}

  @Get('export')
  async export(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() user?: AuthUser,
  ): Promise<StreamableFile> {
    const exported = await this.documentOutputService.exportResult(
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
