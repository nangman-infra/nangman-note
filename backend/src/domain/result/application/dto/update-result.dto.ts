import { IsString, MaxLength } from 'class-validator';

const RESULT_CONTENT_MAX_LENGTH = 200_000;

export class UpdateResultDto {
  @IsString()
  @MaxLength(RESULT_CONTENT_MAX_LENGTH)
  content: string;
}
