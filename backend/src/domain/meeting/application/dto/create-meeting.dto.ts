import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMeetingDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  promptId?: string;
}
