import { IsArray, IsString, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class BulkMeetingIdsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'ids 배열에 최소 1개의 ID가 필요합니다' })
  @ArrayMaxSize(100, { message: '한 번에 최대 100개까지 처리할 수 있습니다' })
  ids: string[];
}
