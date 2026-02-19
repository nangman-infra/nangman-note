import { IsString } from 'class-validator';

export class UpdateMeetingDto {
  @IsString()
  promptId: string;
}
