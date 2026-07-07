import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { RegenerateResultDto } from '../application/dto/regenerate-result.dto';
import { UpdateResultDto } from '../application/dto/update-result.dto';
import { ResultService } from '../application/result.service';
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import type { AuthUser } from '../../../shared/auth/auth-user.interface';
import { ResultEntity } from '../domain/result.entity';

type ResultResponse = ResultEntity & {
  isRegenerating: boolean;
};

@Controller('api/v1/meetings/:meetingId/result')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @Get()
  async getByMeetingId(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const result = await this.resultService.findByMeetingId(
      meetingId,
      user?.sub,
    );
    return this.toResultResponse(result);
  }

  @Patch()
  async update(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body() dto: UpdateResultDto,
    @CurrentUser() user?: AuthUser,
  ) {
    const result = await this.resultService.update(meetingId, dto, user?.sub);
    return this.toResultResponse(result);
  }

  @Post('regenerate')
  @HttpCode(HttpStatus.ACCEPTED)
  async regenerate(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body() dto: RegenerateResultDto,
    @CurrentUser() user?: AuthUser,
  ) {
    await this.resultService.regenerateAsync(meetingId, dto, user?.sub);
    return {
      meetingId,
      promptId: dto.promptId,
      status: 'regenerating',
    };
  }

  private toResultResponse(result: ResultEntity): ResultResponse {
    return {
      ...result,
      isRegenerating: this.resultService.isRegenerating(result.meetingId),
    };
  }
}
