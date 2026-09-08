import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBatchTranscriptionJobDto {
  @IsString()
  @MaxLength(2048)
  @Matches(/^s3:\/\/[a-zA-Z0-9.\-_]+\/.+$/u, {
    message: 'mediaUri must be a valid s3://bucket/key URI',
  })
  mediaUri: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  startOffsetSeconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  languageCode?: string;
}
