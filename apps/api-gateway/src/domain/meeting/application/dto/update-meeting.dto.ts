import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { MeetingTranscriptionMode } from '../../domain/meeting-transcription-mode.enum';

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  promptId?: string;

  @IsOptional()
  @IsEnum(MeetingTranscriptionMode)
  transcriptionMode?: MeetingTranscriptionMode;
}
