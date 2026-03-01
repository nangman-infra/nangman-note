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
}
