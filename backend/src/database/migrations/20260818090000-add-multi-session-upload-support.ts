import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * 멀티 세션 녹음 업로드 지원.
 *
 * 프론트에서 녹음 세션(MediaRecorder 인스턴스)마다 별도 오디오 파일을 업로드하고,
 * 각 파일의 회의 시작 기준 오프셋(start_offset_seconds)을 전달합니다.
 * 배치 수집 시 세그먼트에 오프셋을 더해 하나의 타임라인으로 병합하며,
 * transcript_segment.transcription_job_id 로 잡별 세그먼트를 추적해
 * 재수집 멱등성과 실시간 폴백 세그먼트 보존을 보장합니다.
 */
export class AddMultiSessionUploadSupport20260818090000 implements MigrationInterface {
  name = 'AddMultiSessionUploadSupport20260818090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const uploadTable = await queryRunner.getTable('transcription_upload');
    if (!uploadTable?.findColumnByName('start_offset_seconds')) {
      await queryRunner.addColumn(
        'transcription_upload',
        new TableColumn({
          name: 'start_offset_seconds',
          type: 'float',
          isNullable: true,
        }),
      );
    }

    const jobTable = await queryRunner.getTable('transcription_job');
    if (!jobTable?.findColumnByName('start_offset_seconds')) {
      await queryRunner.addColumn(
        'transcription_job',
        new TableColumn({
          name: 'start_offset_seconds',
          type: 'float',
          isNullable: true,
        }),
      );
    }

    const segmentTable = await queryRunner.getTable('transcript_segment');
    if (!segmentTable?.findColumnByName('transcription_job_id')) {
      await queryRunner.addColumn(
        'transcript_segment',
        new TableColumn({
          name: 'transcription_job_id',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const segmentTable = await queryRunner.getTable('transcript_segment');
    if (segmentTable?.findColumnByName('transcription_job_id')) {
      await queryRunner.dropColumn(
        'transcript_segment',
        'transcription_job_id',
      );
    }

    const jobTable = await queryRunner.getTable('transcription_job');
    if (jobTable?.findColumnByName('start_offset_seconds')) {
      await queryRunner.dropColumn('transcription_job', 'start_offset_seconds');
    }

    const uploadTable = await queryRunner.getTable('transcription_upload');
    if (uploadTable?.findColumnByName('start_offset_seconds')) {
      await queryRunner.dropColumn(
        'transcription_upload',
        'start_offset_seconds',
      );
    }
  }
}
