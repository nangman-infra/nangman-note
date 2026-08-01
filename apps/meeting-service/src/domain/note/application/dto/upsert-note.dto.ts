import { IsString, MaxLength } from 'class-validator';

const NOTE_CONTENT_MAX_LENGTH = 100_000;

export class UpsertNoteDto {
  @IsString()
  @MaxLength(NOTE_CONTENT_MAX_LENGTH)
  content: string;
}
