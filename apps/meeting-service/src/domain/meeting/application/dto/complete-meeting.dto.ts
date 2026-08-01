import { IsBoolean, IsOptional } from 'class-validator';

export class CompleteMeetingDto {
  @IsOptional()
  @IsBoolean()
  skipTranscription?: boolean;

  @IsOptional()
  @IsBoolean()
  markAttentionRequired?: boolean;
}
