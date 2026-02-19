import { IsString } from 'class-validator';

export class UpsertNoteDto {
  @IsString()
  content: string;
}
