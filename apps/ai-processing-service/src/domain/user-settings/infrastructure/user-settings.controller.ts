import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import type { AuthUser } from '../../../shared/auth/auth-user.interface';
import { UpdateUserSettingsDto } from '../application/dto/update-user-settings.dto';
import { UserSettingsService } from '../application/user-settings.service';

@Controller('api/v1/user-settings')
export class UserSettingsController {
  constructor(private readonly userSettingsService: UserSettingsService) {}

  @Get()
  async get(@CurrentUser() user?: AuthUser) {
    return this.userSettingsService.get(user?.sub);
  }

  @Patch()
  async update(
    @Body() dto: UpdateUserSettingsDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.userSettingsService.update(dto, user?.sub);
  }
}
