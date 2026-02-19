import { IsString } from 'class-validator';

export class UpdateResultDto {
  @IsString()
  content: string;
}
