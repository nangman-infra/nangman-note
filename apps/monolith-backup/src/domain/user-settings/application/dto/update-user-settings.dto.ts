import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { MeetingTranscriptionMode } from '../../../meeting/domain/meeting-transcription-mode.enum';

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  defaultPromptId?: string;

  @IsOptional()
  @IsEnum(MeetingTranscriptionMode)
  defaultTranscriptionMode?: MeetingTranscriptionMode;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  defaultLanguageCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  defaultTranslateTargetLanguage?: string;
}
