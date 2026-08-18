import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { BulkMeetingIdsDto } from '../application/dto/bulk-meeting-ids.dto';
import { CreateMeetingDto } from '../application/dto/create-meeting.dto';
import { CompleteMeetingDto } from '../application/dto/complete-meeting.dto';
import { ListMeetingsQueryDto } from '../application/dto/list-meetings-query.dto';
import { SearchMeetingsQueryDto } from '../application/dto/search-meetings-query.dto';
import { UpdateMeetingDto } from '../application/dto/update-meeting.dto';
import { MeetingService } from '../application/meeting.service';
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import type { AuthUser } from '../../../shared/auth/auth-user.interface';

@Controller('api/v1/meetings')
export class MeetingController {
  constructor(private readonly meetingService: MeetingService) {}

  @Post()
  async create(@Body() dto: CreateMeetingDto, @CurrentUser() user?: AuthUser) {
    return this.meetingService.create(dto, user?.sub);
  }

  @Get()
  async list(
    @Query() query: ListMeetingsQueryDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.meetingService.list(query, user?.sub);
  }

  @Get('trash')
  async listTrash(
    @Query() query: ListMeetingsQueryDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.meetingService.listTrash(query, user?.sub);
  }

  @Get('search')
  async search(
    @Query() query: SearchMeetingsQueryDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.meetingService.search(query, user?.sub);
  }

  /** 사용자의 전체 회의 데이터(노트·결과·전사 포함)를 JSON으로 내보내기 */
  @Get('export')
  async exportAll(@CurrentUser() user?: AuthUser) {
    return this.meetingService.exportAllData(user?.sub);
  }

  @Post('bulk/delete')
  async bulkRemove(
    @Body() dto: BulkMeetingIdsDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.meetingService.bulkRemove(dto.ids, user?.sub);
  }

  @Post('bulk/restore')
  async bulkRestore(
    @Body() dto: BulkMeetingIdsDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.meetingService.bulkRestore(dto.ids, user?.sub);
  }

  @Post('bulk/purge')
  async bulkPurge(
    @Body() dto: BulkMeetingIdsDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.meetingService.bulkPurge(dto.ids, user?.sub);
  }

  @Get(':id')
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.meetingService.findById(id, user?.sub);
  }

  @Patch(':id')
  async updatePrompt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMeetingDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.meetingService.updatePrompt(id, dto, user?.sub);
  }

  @Post(':id/complete')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteMeetingDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.meetingService.complete(id, dto, user?.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<void> {
    await this.meetingService.remove(id, user?.sub);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<void> {
    await this.meetingService.restore(id, user?.sub);
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  async purge(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<void> {
    await this.meetingService.purge(id, user?.sub);
  }
}
