import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PromptDocumentType } from '../../domain/prompt-document-type.enum';

export class UpdatePromptDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  content?: string;

  @IsOptional()
  @IsEnum(PromptDocumentType)
  documentType?: PromptDocumentType;
}
