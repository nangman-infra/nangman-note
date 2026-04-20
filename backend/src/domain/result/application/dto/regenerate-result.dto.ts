import { IsString, MaxLength } from 'class-validator';

export class RegenerateResultDto {
  @IsString()
  @MaxLength(120)
  promptId: string;
}
