import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePromptDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  content: string;
}
