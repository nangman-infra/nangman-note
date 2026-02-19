import { IsString } from 'class-validator';

export class RegenerateResultDto {
  @IsString()
  promptId: string;
}
