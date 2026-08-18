import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class IssueBatchUploadDto {
  /**
   * 이 업로드 파일이 회의 시작 기준 몇 초 지점부터 녹음됐는지.
   * 멀티 세션 녹음(새로고침·마이크 교체 등으로 녹음이 분할된 경우)에서
   * 세그먼트 타임라인 병합에 사용됩니다.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  startOffsetSeconds?: number;

  /**
   * 업로드할 오디오 파일의 MIME 타입 (기본: audio/webm).
   * 파일 업로드 전사에서 mp3/mp4/wav 등을 지원하기 위해 사용됩니다.
   */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  contentType?: string;
}
