import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

const NOTE_CONTENT_MAX_LENGTH = 100_000;

export class UpsertNoteDto {
  @IsString()
  @MaxLength(NOTE_CONTENT_MAX_LENGTH)
  content: string;

  /** Revision returned by GET; a note that has never been saved has revision 0. */
  @IsInt()
  @Min(0)
  @Max(2_147_483_646)
  expectedRevision: number;
}
