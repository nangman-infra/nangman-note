import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateMeetingDto } from '../application/dto/create-meeting.dto';
import { CompleteMeetingDto } from '../application/dto/complete-meeting.dto';
import { ListMeetingsQueryDto } from '../application/dto/list-meetings-query.dto';
import { SearchMeetingsQueryDto } from '../application/dto/search-meetings-query.dto';
import { UpdateMeetingDto } from '../application/dto/update-meeting.dto';
import { MeetingService } from '../application/meeting.service';

@Controller('api/v1/meetings')
export class MeetingController {
  constructor(private readonly meetingService: MeetingService) {}

  @Post()
  async create(@Body() dto: CreateMeetingDto) {
    return this.meetingService.create(dto);
  }

  @Get()
  async list(@Query() query: ListMeetingsQueryDto) {
    return this.meetingService.list(query);
  }

  @Get('trash')
  async listTrash(@Query() query: ListMeetingsQueryDto) {
    return this.meetingService.listTrash(query);
  }

  @Get('search')
  async search(@Query() query: SearchMeetingsQueryDto) {
    return this.meetingService.search(query);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.meetingService.findById(id);
  }

  @Patch(':id')
  async updatePrompt(@Param('id') id: string, @Body() dto: UpdateMeetingDto) {
    return this.meetingService.updatePrompt(id, dto);
  }

  @Post(':id/complete')
  async complete(@Param('id') id: string, @Body() dto: CompleteMeetingDto) {
    return this.meetingService.complete(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.meetingService.remove(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  async restore(@Param('id') id: string): Promise<void> {
    await this.meetingService.restore(id);
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  async purge(@Param('id') id: string): Promise<void> {
    await this.meetingService.purge(id);
  }
}
