import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromptService } from '../../prompt/application/prompt.service';
import { MeetingTranscriptionMode } from '../../meeting/domain/meeting-transcription-mode.enum';
import { UserSettingsEntity } from '../domain/user-settings.entity';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';

const DEFAULT_PROMPT_ID = 'prompt_default_meeting';
const ANONYMOUS_OWNER_SUB = '__anonymous__';

export interface UserSettingsView {
  defaultPromptId: string;
  defaultTranscriptionMode: MeetingTranscriptionMode;
  defaultLanguageCode: string;
  defaultTranslateTargetLanguage: string;
  isConfigured: boolean;
}

@Injectable()
export class UserSettingsService {
  constructor(
    @InjectRepository(UserSettingsEntity)
    private readonly userSettingsRepository: Repository<UserSettingsEntity>,
    private readonly promptService: PromptService,
  ) {}

  async get(ownerSub?: string): Promise<UserSettingsView> {
    const resolvedOwnerSub = this.resolveOwnerSub(ownerSub);
    const existing = await this.userSettingsRepository.findOne({
      where: { ownerSub: resolvedOwnerSub },
    });
    return this.toView(existing, Boolean(existing));
  }

  async update(
    dto: UpdateUserSettingsDto,
    ownerSub?: string,
  ): Promise<UserSettingsView> {
    const resolvedOwnerSub = this.resolveOwnerSub(ownerSub);
    const existing = await this.userSettingsRepository.findOne({
      where: { ownerSub: resolvedOwnerSub },
    });

    if (dto.defaultPromptId !== undefined) {
      const nextPromptId = dto.defaultPromptId.trim() || DEFAULT_PROMPT_ID;
      await this.promptService.ensureExists(nextPromptId, ownerSub);
    }

    const next = this.userSettingsRepository.create({
      ownerSub: resolvedOwnerSub,
      defaultPromptId:
        dto.defaultPromptId !== undefined
          ? dto.defaultPromptId.trim() || DEFAULT_PROMPT_ID
          : (existing?.defaultPromptId ?? DEFAULT_PROMPT_ID),
      defaultTranscriptionMode:
        dto.defaultTranscriptionMode ??
        existing?.defaultTranscriptionMode ??
        MeetingTranscriptionMode.REALTIME,
      defaultLanguageCode:
        dto.defaultLanguageCode !== undefined
          ? dto.defaultLanguageCode.trim()
          : (existing?.defaultLanguageCode ?? ''),
      defaultTranslateTargetLanguage:
        dto.defaultTranslateTargetLanguage !== undefined
          ? dto.defaultTranslateTargetLanguage.trim()
          : (existing?.defaultTranslateTargetLanguage ?? ''),
    });

    const saved = await this.userSettingsRepository.save(next);
    return this.toView(saved, true);
  }

  private resolveOwnerSub(ownerSub?: string): string {
    return ownerSub?.trim() || ANONYMOUS_OWNER_SUB;
  }

  private toView(
    entity: UserSettingsEntity | null,
    isConfigured: boolean,
  ): UserSettingsView {
    return {
      defaultPromptId: entity?.defaultPromptId?.trim() || DEFAULT_PROMPT_ID,
      defaultTranscriptionMode:
        entity?.defaultTranscriptionMode ?? MeetingTranscriptionMode.REALTIME,
      defaultLanguageCode: entity?.defaultLanguageCode ?? '',
      defaultTranslateTargetLanguage:
        entity?.defaultTranslateTargetLanguage ?? '',
      isConfigured,
    };
  }
}
