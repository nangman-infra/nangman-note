import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CreatePromptDto } from '../application/dto/create-prompt.dto';
import { UpdatePromptDto } from '../application/dto/update-prompt.dto';
import { PromptService } from '../application/prompt.service';

@Controller('api/v1/prompts')
export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  @Get()
  async list() {
    return this.promptService.list();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.promptService.findById(id);
  }

  @Post()
  async create(@Body() dto: CreatePromptDto) {
    return this.promptService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePromptDto) {
    return this.promptService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.promptService.remove(id);
  }
}
