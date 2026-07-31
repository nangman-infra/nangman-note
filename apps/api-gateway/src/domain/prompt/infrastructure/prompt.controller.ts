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
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import type { AuthUser } from '../../../shared/auth/auth-user.interface';

@Controller('api/v1/prompts')
export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  @Get()
  async list(@CurrentUser() user?: AuthUser) {
    return this.promptService.list(user?.sub);
  }

  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.promptService.findById(id, user?.sub);
  }

  @Post()
  async create(@Body() dto: CreatePromptDto, @CurrentUser() user?: AuthUser) {
    return this.promptService.create(dto, user?.sub);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePromptDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.promptService.update(id, dto, user?.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<void> {
    await this.promptService.remove(id, user?.sub);
  }
}
