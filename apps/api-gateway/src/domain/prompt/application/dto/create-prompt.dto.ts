import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { PromptDocumentType } from '../../domain/prompt-document-type.enum';

export class CreatePromptDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  content: string;

  @IsEnum(PromptDocumentType)
  documentType: PromptDocumentType;
}
