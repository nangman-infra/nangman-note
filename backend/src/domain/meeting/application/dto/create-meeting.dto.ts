import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { MeetingTranscriptionMode } from '../../domain/meeting-transcription-mode.enum';

export class CreateMeetingDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  agenda?: string;

  @IsOptional()
  @IsString()
  promptId?: string;

  @IsOptional()
  @IsEnum(MeetingTranscriptionMode)
  transcriptionMode?: MeetingTranscriptionMode;

  /** 전사 언어 코드 (e.g. 'ko-KR', 'en-US'). 미입력 시 자동 감지 */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  languageCode?: string;

  /** 번역 대상 언어 (e.g. 'ko', 'en'). 미입력 시 번역 안 함 */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  translateTargetLanguage?: string;
}
